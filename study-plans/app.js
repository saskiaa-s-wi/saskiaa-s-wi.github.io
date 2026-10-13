// app.js - Universal Study Notes & Plans Hub Application Logic

// Initialize Supabase Client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Bucket Configuration
const BUCKET_NAME = 'user-files';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

// Allowed file extensions and mime-types
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'ogg', 'mov', 'mp3', 'wav', 'pdf', 'docx'];

// Application State Variables
let isSignUpMode = false;
let currentUser = null;
let noteToDeleteId = null;
let noteToDeleteFilePath = null;

// DOM Element References
const authScreen = document.getElementById("auth-screen");
const usernameScreen = document.getElementById("username-screen");
const dashboardScreen = document.getElementById("dashboard-screen");
const settingsScreen = document.getElementById("settings-screen");

const navActions = document.getElementById("nav-actions");
const userDisplay = document.getElementById("user-display");
const navDashboardBtn = document.getElementById("nav-dashboard-btn");
const navSettingsBtn = document.getElementById("nav-settings-btn");
const signoutBtn = document.getElementById("signout-btn");

const authForm = document.getElementById("auth-form");
const authTitle = document.getElementById("auth-title");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const authToggleText = document.getElementById("auth-toggle-text");
const authToggleLink = document.getElementById("auth-toggle-link");
const passwordHint = document.getElementById("password-hint");
const githubSigninBtn = document.getElementById("github-signin-btn");
const authMsg = document.getElementById("auth-msg");

const usernameForm = document.getElementById("username-form");
const usernameInput = document.getElementById("username-input");

const uploadForm = document.getElementById("upload-form");
const uploadBtn = document.getElementById("upload-btn");
const progressContainer = document.getElementById("progress-container");
const uploadProgressBar = document.getElementById("upload-progress-bar");
const uploadProgressText = document.getElementById("upload-progress-text");

const tabPublic = document.getElementById("tab-public");
const tabPrivate = document.getElementById("tab-private");
const publicNotesSection = document.getElementById("public-notes-section");
const privateNotesSection = document.getElementById("private-notes-section");
const publicNotesList = document.getElementById("public-notes-list");
const privateNotesList = document.getElementById("private-notes-list");

const changePasswordForm = document.getElementById("change-password-form");
const changePasswordBox = document.getElementById("change-password-box");

const deleteModal = document.getElementById("delete-modal");
const cancelDeleteBtn = document.getElementById("cancel-delete-btn");
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");

// Password Rule Validation
function validatePassword(password) {
  const minLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return minLength && hasUpper && hasLower && hasNumber;
}

// Format bytes into readable string
function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Display Message Banner
function showMsg(text, isError = true) {
  if (!authMsg) return;
  authMsg.innerText = text;
  authMsg.className = `message ${isError ? 'error' : 'success'}`;
}

// Clear Message Banner
function clearMsg() {
  if (!authMsg) return;
  authMsg.innerText = "";
  authMsg.className = "message";
}

// Switch Active Screen
function showScreen(screen) {
  if (!screen) return;
  if (authScreen) authScreen.classList.remove("active");
  if (usernameScreen) usernameScreen.classList.remove("active");
  if (dashboardScreen) dashboardScreen.classList.remove("active");
  if (settingsScreen) settingsScreen.classList.remove("active");

  screen.classList.add("active");
}

// Application Initialization
async function initApp() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    await handleAuthState(session);

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      await handleAuthState(session);
    });
  } catch (err) {
    showMsg(err.message || "Failed to initialize authentication.");
  }
}

// Handle Auth State Changes
async function handleAuthState(session) {
  clearMsg();
  if (!session) {
    currentUser = null;
    if (navActions) navActions.style.display = "none";
    showScreen(authScreen);
    return;
  }

  currentUser = session.user;
  if (navActions) navActions.style.display = "flex";

  // Check if profile row exists for current user
  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("username")
    .eq("id", currentUser.id)
    .single();

  if (error || !profile || !profile.username) {
    showScreen(usernameScreen);
  } else {
    if (userDisplay) userDisplay.innerText = `@${profile.username}`;
    
    // Hide password change box for OAuth users
    if (currentUser.app_metadata && currentUser.app_metadata.provider === "github") {
      if (changePasswordBox) changePasswordBox.style.display = "none";
    } else {
      if (changePasswordBox) changePasswordBox.style.display = "block";
    }

    if (!settingsScreen || !settingsScreen.classList.contains("active")) {
      showScreen(dashboardScreen);
      loadDashboardNotes();
    }
  }
}

// Toggle Sign-In / Sign-Up Mode
if (authToggleLink) {
  authToggleLink.addEventListener("click", (e) => {
    e.preventDefault();
    isSignUpMode = !isSignUpMode;
    clearMsg();
    if (isSignUpMode) {
      if (authTitle) authTitle.innerText = "Sign Up";
      if (authSubmitBtn) authSubmitBtn.innerText = "Create Account";
      if (authToggleText) authToggleText.innerText = "Already have an account?";
      if (authToggleLink) authToggleLink.innerText = "Sign In";
      if (passwordHint) passwordHint.style.display = "block";
    } else {
      if (authTitle) authTitle.innerText = "Sign In";
      if (authSubmitBtn) authSubmitBtn.innerText = "Sign In";
      if (authToggleText) authToggleText.innerText = "Don't have an account?";
      if (authToggleLink) authToggleLink.innerText = "Sign Up";
      if (passwordHint) passwordHint.style.display = "none";
    }
  });
}

// Submit Sign-In / Sign-Up Form
if (authForm) {
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMsg();

    const email = authEmail.value.trim();
    const password = authPassword.value;

    if (isSignUpMode) {
      if (!validatePassword(password)) {
        showMsg("Password must be at least 8 characters long and contain at least 1 uppercase letter, 1 lowercase letter, and 1 number.");
        return;
      }

      const { error } = await supabaseClient.auth.signUp({ email, password });
      if (error) {
        showMsg(error.message);
      } else {
        showMsg("Account created successfully! You can now log in.", false);
        authToggleLink.click();
      }
    } else {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        showMsg(error.message);
      }
    }
  });
}

// GitHub OAuth Sign-In
if (githubSigninBtn) {
  githubSigninBtn.addEventListener("click", async () => {
    clearMsg();
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: window.location.href
      }
    });
    if (error) showMsg(error.message);
  });
}

// First-time Username Form Handler
if (usernameForm) {
  usernameForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMsg();

    const username = usernameInput.value.trim();
    if (!username) return;

    // Check if username already exists in profiles
    const { data: existingUser, error: checkError } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (checkError) {
      showMsg(`Error checking username: ${checkError.message}`);
      return;
    }

    if (existingUser && existingUser.id !== currentUser.id) {
      showMsg("This username is already taken. Please choose another one.");
      return;
    }

    // Upsert user profile row
    const { error } = await supabaseClient
      .from("profiles")
      .upsert({ id: currentUser.id, username: username, created_at: new Date() });

    if (error) {
      showMsg(error.message.includes("unique") ? "Username is already taken. Please try another." : error.message);
    } else {
      if (userDisplay) userDisplay.innerText = `@${username}`;
      showMsg("Username saved successfully!", false);
      showScreen(dashboardScreen);
      loadDashboardNotes();
    }
  });
}

// Navigation Listeners
if (navDashboardBtn) {
  navDashboardBtn.addEventListener("click", () => {
    showScreen(dashboardScreen);
    loadDashboardNotes();
  });
}

if (navSettingsBtn) {
  navSettingsBtn.addEventListener("click", () => {
    showScreen(settingsScreen);
  });
}

if (signoutBtn) {
  signoutBtn.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
  });
}

// Change Password Handler
if (changePasswordForm) {
  changePasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMsg();

    const newPassword = document.getElementById("new-password").value;

    if (!validatePassword(newPassword)) {
      showMsg("Password must be at least 8 characters long and contain at least 1 uppercase letter, 1 lowercase letter, and 1 number.");
      return;
    }

    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
    if (error) {
      showMsg(error.message);
    } else {
      showMsg("Password updated successfully!", false);
      document.getElementById("new-password").value = "";
    }
  });
}

// Dashboard Tab Switching
if (tabPublic && tabPrivate) {
  tabPublic.addEventListener("click", () => {
    tabPublic.classList.add("active");
    tabPrivate.classList.remove("active");
    publicNotesSection.style.display = "block";
    privateNotesSection.style.display = "none";
  });

  tabPrivate.addEventListener("click", () => {
    tabPrivate.classList.add("active");
    tabPublic.classList.remove("active");
    privateNotesSection.style.display = "block";
    publicNotesSection.style.display = "none";
  });
}

// Upload Form Handler with Real Progress & Validation
if (uploadForm) {
  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMsg();

    const classTitle = document.getElementById("class-title").value.trim();
    const topicUnit = document.getElementById("topic-unit").value.trim();
    const description = document.getElementById("note-description").value.trim();
    const fileInput = document.getElementById("note-file");
    const isPublic = document.getElementById("is-public").checked;

    const file = fileInput.files[0];
    if (!file) {
      showMsg("Please select a file to upload.");
      return;
    }

    // 1. Client-side File Type Check
    const fileExt = file.name.split('.').pop().toLowerCase();
    const isMimeVideo = file.type.startsWith('video/');
    const isMimeAudio = file.type.startsWith('audio/');
    
    if (!ALLOWED_EXTENSIONS.includes(fileExt) && !isMimeVideo && !isMimeAudio) {
      showMsg("Invalid file type. Allowed formats: JPG, PNG, WEBP, GIF, video, audio, PDF, and Word (.docx).");
      return;
    }

    // 2. Client-side File Size Check (10MB limit)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      showMsg(`File size exceeds 10 MB limit. Your file is ${formatBytes(file.size)}.`);
      return;
    }

    // Clean filename and structure destination path: [user id]/[timestamp]-[file name]
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${currentUser.id}/${Date.now()}-${cleanFileName}`;

    // Disable button & setup progress UI
    if (uploadBtn) uploadBtn.disabled = true;
    if (progressContainer) progressContainer.style.display = "block";
    if (uploadProgressBar) uploadProgressBar.value = 0;
    if (uploadProgressText) uploadProgressText.innerText = "0%";

    try {
      // Upload file with REAL progress reporting via Supabase Storage Options
      const { data: storageData, error: uploadError } = await supabaseClient.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: (progress) => {
            if (progress.total > 0) {
              const percent = Math.round((progress.loaded / progress.total) * 100);
              if (uploadProgressBar) uploadProgressBar.value = percent;
              if (uploadProgressText) uploadProgressText.innerText = `${percent}% uploaded`;
            }
          }
        });

      if (uploadError) {
        showMsg(`Upload failed: ${uploadError.message}`);
        return;
      }

      // Save record in database
      const { error: dbError } = await supabaseClient
        .from("study_notes")
        .insert({
          user_id: currentUser.id,
          class_title: classTitle,
          topic_unit: topicUnit,
          description: description,
          file_url: filePath, // Storing file path in bucket
          file_name: file.name,
          file_size: file.size,
          is_public: isPublic,
          created_at: new Date()
        });

      if (dbError) {
        showMsg(`Failed to save record: ${dbError.message}`);
      } else {
        showMsg("File uploaded successfully!", false);
        uploadForm.reset();
        loadDashboardNotes();
      }
    } catch (err) {
      showMsg(`Upload failed: ${err.message || err}`);
    } finally {
      if (uploadBtn) uploadBtn.disabled = false;
      if (progressContainer) progressContainer.style.display = "none";
    }
  });
}

// Fetch Signed/Public URL for a storage file path
async function getFileAccessUrl(filePath) {
  if (!filePath) return "";
  
  // Try Signed URL first (for private bucket setups)
  const { data: signedData, error: signedError } = await supabaseClient.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, 3600); // 1 hour validity

  if (!signedError && signedData?.signedUrl) {
    return signedData.signedUrl;
  }

  // Fallback to Public URL
  const { data: publicData } = supabaseClient.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return publicData?.publicUrl || "";
}

// Load Dashboard Items
async function loadDashboardNotes() {
  // Fetch profiles map for user author display
  const { data: profiles, error: profilesError } = await supabaseClient.from("profiles").select("id, username");
  if (profilesError) {
    showMsg(`Error loading profiles: ${profilesError.message}`);
  }
  
  const profileMap = {};
  if (profiles) {
    profiles.forEach(p => { profileMap[p.id] = p.username; });
  }

  // Fetch Public Records
  const { data: publicNotes, error: publicError } = await supabaseClient
    .from("study_notes")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  if (publicError) showMsg(`Error loading public materials: ${publicError.message}`);

  // Fetch Private Records
  const { data: privateNotes, error: privateError } = await supabaseClient
    .from("study_notes")
    .select("*")
    .eq("user_id", currentUser.id)
    .eq("is_public", false)
    .order("created_at", { ascending: false });

  if (privateError) showMsg(`Error loading private materials: ${privateError.message}`);

  if (publicNotesList) await renderNotes(publicNotes || [], publicNotesList, profileMap);
  if (privateNotesList) await renderNotes(privateNotes || [], privateNotesList, profileMap);
}

// Render Media Element based on file extension
function buildMediaMarkup(fileUrl, fileName) {
  const ext = (fileName || fileUrl).split('.').pop().split('?')[0].toLowerCase();

  // Images
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
    return `
      <div class="media-preview">
        <img src="${fileUrl}" alt="${escapeHtml(fileName)}" loading="lazy">
      </div>`;
  }

  // Videos
  if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) {
    return `
      <div class="media-preview">
        <video controls preload="metadata">
          <source src="${fileUrl}">
          Your browser does not support video playback.
        </video>
      </div>`;
  }

  // Audio
  if (['mp3', 'wav'].includes(ext)) {
    return `
      <div class="media-preview">
        <audio controls preload="metadata">
          <source src="${fileUrl}">
          Your browser does not support audio playback.
        </audio>
      </div>`;
  }

  // PDF & Word Document Link
  return `
    <div style="margin-bottom: 0.75rem;">
      <a href="${fileUrl}" target="_blank" rel="noopener noreferrer" class="file-link">
        📄 View / Download ${escapeHtml(fileName || 'Document')}
      </a>
    </div>`;
}

// Render Notes & Files Cards
async function renderNotes(notes, container, profileMap) {
  if (notes.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem; grid-column: 1 / -1;">No materials found.</p>`;
    return;
  }

  const cardsHtml = await Promise.all(notes.map(async (note) => {
    const isOwner = note.user_id === currentUser.id;
    const author = profileMap[note.user_id] ? `@${profileMap[note.user_id]}` : "Unknown";
    
    // Resolve access URL (signed URL for private bucket or fallback)
    const fileUrl = await getFileAccessUrl(note.file_url);
    const fileName = note.file_name || note.file_url.split('/').pop();
    const mediaMarkup = buildMediaMarkup(fileUrl, fileName);
    const formattedSize = note.file_size ? formatBytes(note.file_size) : '';

    return `
      <div class="note-card">
        <div>
          <span class="badge">${escapeHtml(note.class_title)}</span>
          <h3>${escapeHtml(note.topic_unit)}</h3>
          <p>${escapeHtml(note.description || 'No description provided.')}</p>

          ${mediaMarkup}

          <div style="margin-bottom: 0.75rem;">
            <div style="font-weight: 600; font-size: 0.85rem;">${escapeHtml(fileName)}</div>
            ${formattedSize ? `<div class="file-size">Size: ${formattedSize}</div>` : ''}
          </div>
        </div>
        <div>
          <div class="meta">Uploaded by <strong>${escapeHtml(author)}</strong></div>
          <div class="actions">
            <a href="${fileUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
              <button type="button" class="secondary" style="font-size:0.8rem; padding:0.4rem 0.8rem;">Open File</button>
            </a>
            ${isOwner ? `
              <button type="button" class="danger" onclick="openDeleteModal('${note.id}', '${escapeHtml(note.file_url)}')" style="font-size:0.8rem; padding:0.4rem 0.8rem;">Delete</button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }));

  container.innerHTML = cardsHtml.join('');
}

// Open Delete Confirmation Modal
window.openDeleteModal = function(noteId, filePath) {
  noteToDeleteId = noteId;
  noteToDeleteFilePath = filePath;
  if (deleteModal) deleteModal.classList.add("active");
};

// Close Delete Confirmation Modal
function closeDeleteModal() {
  noteToDeleteId = null;
  noteToDeleteFilePath = null;
  if (deleteModal) deleteModal.classList.remove("active");
}

if (cancelDeleteBtn) {
  cancelDeleteBtn.addEventListener("click", closeDeleteModal);
}

// Confirm Delete Event Handler
if (confirmDeleteBtn) {
  confirmDeleteBtn.addEventListener("click", async () => {
    if (!noteToDeleteId) return;

    // Delete DB record
    const { error: dbError } = await supabaseClient
      .from("study_notes")
      .delete()
      .eq("id", noteToDeleteId);

    if (dbError) {
      showMsg(`Failed to delete record: ${dbError.message}`);
    } else {
      // Remove file from storage bucket
      try {
        if (noteToDeleteFilePath) {
          const { error: storageDeleteError } = await supabaseClient.storage
            .from(BUCKET_NAME)
            .remove([noteToDeleteFilePath]);

          if (storageDeleteError) {
            console.warn("Storage removal note:", storageDeleteError.message);
          }
        }
      } catch (e) {
        console.error("Storage cleanup error:", e);
      }

      showMsg("Material deleted successfully.", false);
      loadDashboardNotes();
    }

    closeDeleteModal();
  });
}

// Helper to sanitize text output against XSS
function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (m) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

// Start App
initApp();