// app.js - Universal Study Notes & Plans Hub Application Logic

// Initialize Supabase Client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Application State Variables
let isSignUpMode = false;
let currentUser = null;
let noteToDeleteId = null;
let noteToDeleteFileUrl = null;

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

// Password Rule: 8+ chars, 1 uppercase, 1 lowercase, 1 number
function validatePassword(password) {
  const minLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return minLength && hasUpper && hasLower && hasNumber;
}

// Display Toast Message
function showMsg(text, isError = true) {
  if (!authMsg) return;
  authMsg.innerText = text;
  authMsg.className = `message ${isError ? 'error' : 'success'}`;
}

// Clear Toast Message
function clearMsg() {
  if (!authMsg) return;
  authMsg.innerText = "";
  authMsg.className = "message";
}

// Switch Screen View
function showScreen(screen) {
  if (!screen) return;
  if (authScreen) authScreen.classList.remove("active");
  if (usernameScreen) usernameScreen.classList.remove("active");
  if (dashboardScreen) dashboardScreen.classList.remove("active");
  if (settingsScreen) settingsScreen.classList.remove("active");

  screen.classList.add("active");
}

async function initApp() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    await handleAuthState(session);

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      await handleAuthState(session);
    });
  } catch (err) {
    console.error("Initialization error:", err);
  }
}

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

  // Check if profile exists for current user
  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("username")
    .eq("id", currentUser.id)
    .single();

  if (error || !profile || !profile.username) {
    showScreen(usernameScreen);
  } else {
    if (userDisplay) userDisplay.innerText = `@${profile.username}`;
    
    // Hide password change UI for OAuth users
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
        redirectTo: window.location.origin
      }
    });
    if (error) showMsg(error.message);
  });
}

// Username Form Submit
if (usernameForm) {
  usernameForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMsg();

    const username = usernameInput.value.trim();
    if (!username) return;

    const { error } = await supabaseClient
      .from("profiles")
      .upsert({ id: currentUser.id, username: username, created_at: new Date() });

    if (error) {
      showMsg(error.message.includes("unique") ? "Username is already taken." : error.message);
    } else {
      if (userDisplay) userDisplay.innerText = `@${username}`;
      showScreen(dashboardScreen);
      loadDashboardNotes();
    }
  });
}

// Navigation Buttons
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

// Change Password Form
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

// Dashboard Tabs
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

// Upload Study Material Form
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

    // File type validation
    const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg'];
    const fileExt = file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(fileExt)) {
      showMsg("Invalid file type. Please upload a PDF, PNG, or JPG file.");
      return;
    }

    // Validate File Size (Max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      showMsg("File size exceeds 50MB limit.");
      return;
    }

    // Upload File to notes_bucket
    const filePath = `${currentUser.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabaseClient.storage
      .from("notes_bucket")
      .upload(filePath, file);

    if (uploadError) {
      showMsg(`Upload failed: ${uploadError.message}`);
      return;
    }

    // Get Public File URL
    const { data: urlData } = supabaseClient.storage
      .from("notes_bucket")
      .getPublicUrl(filePath);

    // Insert Record in study_notes table
    const { error: dbError } = await supabaseClient
      .from("study_notes")
      .insert({
        user_id: currentUser.id,
        class_title: classTitle,
        topic_unit: topicUnit,
        description: description,
        file_url: urlData.publicUrl,
        is_public: isPublic,
        created_at: new Date()
      });

    if (dbError) {
      showMsg(`Failed to save record: ${dbError.message}`);
    } else {
      showMsg("Study material uploaded successfully!", false);
      uploadForm.reset();
      loadDashboardNotes();
    }
  });
}

// Load Dashboard Notes & Plans
async function loadDashboardNotes() {
  // Fetch profiles map for author names
  const { data: profiles } = await supabaseClient.from("profiles").select("id, username");
  const profileMap = {};
  if (profiles) {
    profiles.forEach(p => { profileMap[p.id] = p.username; });
  }

  // Fetch Public Notes
  const { data: publicNotes } = await supabaseClient
    .from("study_notes")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  if (publicNotesList) renderNotes(publicNotes || [], publicNotesList, profileMap);

  // Fetch User's Private Notes
  const { data: privateNotes } = await supabaseClient
    .from("study_notes")
    .select("*")
    .eq("user_id", currentUser.id)
    .eq("is_public", false)
    .order("created_at", { ascending: false });

  if (privateNotesList) renderNotes(privateNotes || [], privateNotesList, profileMap);
}

// Render Notes Cards
function renderNotes(notes, container, profileMap) {
  if (notes.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem; grid-column: 1 / -1;">No materials found.</p>`;
    return;
  }

  container.innerHTML = notes.map(note => {
    const isOwner = note.user_id === currentUser.id;
    const author = profileMap[note.user_id] ? `@${profileMap[note.user_id]}` : "Unknown";
    
    return `
      <div class="note-card">
        <div>
          <span class="badge">${escapeHtml(note.class_title)}</span>
          <h3>${escapeHtml(note.topic_unit)}</h3>
          <p>${escapeHtml(note.description || 'No description provided.')}</p>
        </div>
        <div>
          <div class="meta">Uploaded by <strong>${escapeHtml(author)}</strong></div>
          <div class="actions">
            <a href="${note.file_url}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
              <button type="button" class="secondary" style="font-size:0.8rem; padding:0.4rem 0.8rem;">View File</button>
            </a>
            ${isOwner ? `
              <button type="button" class="danger" onclick="openDeleteModal('${note.id}', '${note.file_url}')" style="font-size:0.8rem; padding:0.4rem 0.8rem;">Delete</button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Open Custom Delete Modal
window.openDeleteModal = function(noteId, fileUrl) {
  noteToDeleteId = noteId;
  noteToDeleteFileUrl = fileUrl;
  if (deleteModal) deleteModal.classList.add("active");
};

// Close Delete Modal
function closeDeleteModal() {
  noteToDeleteId = null;
  noteToDeleteFileUrl = null;
  if (deleteModal) deleteModal.classList.remove("active");
}

if (cancelDeleteBtn) {
  cancelDeleteBtn.addEventListener("click", closeDeleteModal);
}

// Confirm Delete Handler
if (confirmDeleteBtn) {
  confirmDeleteBtn.addEventListener("click", async () => {
    if (!noteToDeleteId) return;

    // Delete DB entry
    const { error: dbError } = await supabaseClient
      .from("study_notes")
      .delete()
      .eq("id", noteToDeleteId);

    if (dbError) {
      showMsg(`Failed to delete material: ${dbError.message}`);
    } else {
      // Attempt to delete file from storage bucket
      try {
        if (noteToDeleteFileUrl) {
          const urlObj = new URL(noteToDeleteFileUrl);
          const pathParts = urlObj.pathname.split("/notes_bucket/");
          if (pathParts[1]) {
            const filePath = decodeURIComponent(pathParts[1]);
            await supabaseClient.storage.from("notes_bucket").remove([filePath]);
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

// Utility to prevent XSS
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

// Kick off app initialization
initApp();