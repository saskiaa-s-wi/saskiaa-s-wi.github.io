// app.js - Main Application Logic[cite: 1]

// Initialize Supabase Client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State
let isSignUpMode = false;
let currentUser = null;

// DOM Elements
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

// Password Validation Rule: 8+ chars, 1 uppercase, 1 lowercase, 1 number
function validatePassword(password) {
  const minLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return minLength && hasUpper && hasLower && hasNumber;
}

// UI Helper Functions
function showMsg(text, isError = true) {
  authMsg.innerText = text;
  authMsg.className = `message ${isError ? 'error' : 'success'}`;
}

function clearMsg() {
  authMsg.innerText = "";
  authMsg.className = "message";
}

function showScreen(screen) {
  authScreen.classList.remove("active");
  usernameScreen.classList.remove("active");
  dashboardScreen.classList.remove("active");
  settingsScreen.classList.remove("active");

  screen.classList.add("active");
}

// Auth State Initialization & Listener
async function initApp() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  handleAuthState(session);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    handleAuthState(session);
  });
}

async function handleAuthState(session) {
  clearMsg();
  if (!session) {
    currentUser = null;
    navActions.style.display = "none";
    showScreen(authScreen);
    return;
  }

  currentUser = session.user;
  navActions.style.display = "flex";

  // Check if profile exists
  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("username")
    .eq("id", currentUser.id)
    .single();

  if (error || !profile || !profile.username) {
    showScreen(usernameScreen);
  } else {
    userDisplay.innerText = `@${profile.username}`;
    
    // Hide password change for GitHub provider users
    if (currentUser.app_metadata && currentUser.app_metadata.provider === "github") {
      changePasswordBox.style.display = "none";
    } else {
      changePasswordBox.style.display = "block";
    }

    if (!settingsScreen.classList.contains("active")) {
      showScreen(dashboardScreen);
      loadDashboardNotes();
    }
  }
}

// Auth Mode Toggle
authToggleLink.addEventListener("click", (e) => {
  e.preventDefault();
  isSignUpMode = !isSignUpMode;
  clearMsg();
  if (isSignUpMode) {
    authTitle.innerText = "Sign Up";
    authSubmitBtn.innerText = "Create Account";
    authToggleText.innerText = "Already have an account?";
    authToggleLink.innerText = "Sign In";
    passwordHint.style.display = "block";
  } else {
    authTitle.innerText = "Sign In";
    authSubmitBtn.innerText = "Sign In";
    authToggleText.innerText = "Don't have an account?";
    authToggleLink.innerText = "Sign Up";
    passwordHint.style.display = "none";
  }
});

// Submit Sign-In / Sign-Up Form
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
      showMsg("Account created! Check your email or sign in.", false);
    }
  } else {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      showMsg(error.message);
    }
  }
});

// GitHub OAuth Sign-In
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

// Username Form Submit
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
    userDisplay.innerText = `@${username}`;
    showScreen(dashboardScreen);
    loadDashboardNotes();
  }
});

// Navigation Buttons
navDashboardBtn.addEventListener("click", () => {
  showScreen(dashboardScreen);
  loadDashboardNotes();
});

navSettingsBtn.addEventListener("click", () => {
  showScreen(settingsScreen);
});

signoutBtn.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
});

// Change Password Form
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

// Dashboard Tabs
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

// Upload Study Note
uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMsg();

  const classTitle = document.getElementById("class-title").value.trim();
  const topicUnit = document.getElementById("topic-unit").value.trim();
  const description = document.getElementById("note-description").value.trim();
  const fileInput = document.getElementById("note-file");
  const isPublic = document.getElementById("is-public").checked;

  const file = fileInput.files[0];
  if (!file) return;

  // Validate File Size (Max 50MB)
  if (file.size > 50 * 1024 * 1024) {
    showMsg("File size exceeds 50MB limit.");
    return;
  }

  // Upload File to notes_bucket
  const fileExt = file.name.split('.').pop();
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
    showMsg(`Failed to save note record: ${dbError.message}`);
  } else {
    showMsg("Study note uploaded successfully!", false);
    uploadForm.reset();
    loadDashboardNotes();
  }
});

// Load Dashboard Study Notes
async function loadDashboardNotes() {
  // Fetch profiles map for uploader names
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

  renderNotes(publicNotes || [], publicNotesList, profileMap);

  // Fetch User's Private Notes
  const { data: privateNotes } = await supabaseClient
    .from("study_notes")
    .select("*")
    .eq("user_id", currentUser.id)
    .eq("is_public", false)
    .order("created_at", { ascending: false });

  renderNotes(privateNotes || [], privateNotesList, profileMap);
}

// Render Notes Cards
function renderNotes(notes, container, profileMap) {
  if (notes.length === 0) {
    container.innerHTML = `<p style="color: #64748b; font-size: 0.9rem;">No study notes found.</p>`;
    return;
  }

  container.innerHTML = notes.map(note => {
    const isOwner = note.user_id === currentUser.id;
    const author = profileMap[note.user_id] ? `@${profileMap[note.user_id]}` : "Unknown";
    
    return `
      <div class="note-card">
        <span class="badge">${escapeHtml(note.class_title)}</span>
        <h3>${escapeHtml(note.topic_unit)}</h3>
        <p>${escapeHtml(note.description || 'No description provided.')}</p>
        <div class="meta">Uploaded by <strong>${escapeHtml(author)}</strong></div>
        <div class="actions">
          <a href="${note.file_url}" target="_blank" rel="noopener noreferrer">
            <button type="button" class="secondary" style="font-size:0.8rem; padding:0.4rem 0.8rem;">View File</button>
          </a>
          ${isOwner ? `
            <button type="button" class="danger" onclick="deleteNote('${note.id}', '${note.file_url}')" style="font-size:0.8rem; padding:0.4rem 0.8rem;">Delete</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Delete Note Helper
window.deleteNote = async function(noteId, fileUrl) {
  if (!confirm("Are you sure you want to delete this study note?")) return;

  // Delete DB entry
  const { error: dbError } = await supabaseClient
    .from("study_notes")
    .delete()
    .eq("id", noteId);

  if (dbError) {
    showMsg(`Failed to delete note: ${dbError.message}`);
    return;
  }

  // Attempt to delete from bucket if URL matches
  try {
    const urlObj = new URL(fileUrl);
    const pathParts = urlObj.pathname.split("/notes_bucket/");
    if (pathParts[1]) {
      const filePath = decodeURIComponent(pathParts[1]);
      await supabaseClient.storage.from("notes_bucket").remove([filePath]);
    }
  } catch (e) {
    console.error("Storage cleanup error:", e);
  }

  showMsg("Note deleted successfully.", false);
  loadDashboardNotes();
};

// Utility to prevent XSS
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

// Kick off initialization
initApp();