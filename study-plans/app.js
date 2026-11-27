// app.js - Study Notes Hub Application Logic
// Roles: every account is a "user". The admin (set by email in Supabase) can make
// users into moderators. Moderators and the admin can delete any PUBLIC note.
// The database enforces all of this. The checks in this file only decide which
// buttons to show.

// Initialize Supabase Client (SUPABASE_URL and SUPABASE_ANON_KEY come from config.js)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Bucket Configuration
const BUCKET_NAME = 'user-files';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

// Allowed file extensions
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'ogg', 'mov', 'mp3', 'wav', 'pdf', 'docx'];

// Application State Variables
let isSignUpMode = false;
let currentUser = null;
let currentRole = 'user'; // 'user', 'moderator' or 'admin' (read from the profiles table)
let noteToDeleteId = null;
let noteToDeleteFilePath = null;
let reportTargetType = null; // 'post' or 'user'
let reportTargetId = null;
let signedOutNotice = null; // a message to show on the sign-in screen after signing out
let isDeletingData = false;

// DOM Element References
const authScreen = document.getElementById("auth-screen");
const usernameScreen = document.getElementById("username-screen");
const dashboardScreen = document.getElementById("dashboard-screen");
const settingsScreen = document.getElementById("settings-screen");
const adminScreen = document.getElementById("admin-screen");
const privacyScreen = document.getElementById("privacy-screen");
const privacyLink = document.getElementById("privacy-link");
const privacyBackBtn = document.getElementById("privacy-back-btn");
let screenBeforePrivacy = null; // the screen to return to when leaving the privacy page

const navActions = document.getElementById("nav-actions");
const userDisplay = document.getElementById("user-display");
const roleBadge = document.getElementById("role-badge");
const navDashboardBtn = document.getElementById("nav-dashboard-btn");
const navSettingsBtn = document.getElementById("nav-settings-btn");
const navAdminBtn = document.getElementById("nav-admin-btn");
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
const usernameField = document.getElementById("username-input");

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

const addModeratorForm = document.getElementById("add-moderator-form");
const moderatorUsernameField = document.getElementById("moderator-username");
const usersTableBody = document.getElementById("users-table-body");
const moderatorTools = document.getElementById("moderator-tools");
const reportsList = document.getElementById("reports-list");

const reportModal = document.getElementById("report-modal");
const reportModalTitle = document.getElementById("report-modal-title");
const reportReasonField = document.getElementById("report-reason");
const reportCharCount = document.getElementById("report-char-count");
const reportModalMsg = document.getElementById("report-modal-msg");
const cancelReportBtn = document.getElementById("cancel-report-btn");
const submitReportBtn = document.getElementById("submit-report-btn");

const deleteDataBtn = document.getElementById("delete-data-btn");
const deleteDataModal = document.getElementById("delete-data-modal");
const deleteDataConfirmField = document.getElementById("delete-data-confirm");
const deleteDataMsg = document.getElementById("delete-data-msg");
const cancelDeleteDataBtn = document.getElementById("cancel-delete-data-btn");
const confirmDeleteDataBtn = document.getElementById("confirm-delete-data-btn");

const deleteModal = document.getElementById("delete-modal");
const cancelDeleteBtn = document.getElementById("cancel-delete-btn");
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");

// Password Rule Validation: 8+ characters, 1 uppercase, 1 lowercase, 1 number
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
  [authScreen, usernameScreen, dashboardScreen, settingsScreen, adminScreen, privacyScreen].forEach((s) => {
    if (s) s.classList.remove("active");
  });
  screen.classList.add("active");
}

// Role helpers
function isAdmin() {
  return currentRole === 'admin';
}

function isModeratorOrAdmin() {
  return currentRole === 'moderator' || currentRole === 'admin';
}

// Show the role badge and the Admin button
function updateRoleUI() {
  if (roleBadge) {
    if (currentRole === 'admin' || currentRole === 'moderator') {
      roleBadge.innerText = currentRole;
      roleBadge.style.display = "inline-block";
    } else {
      roleBadge.innerText = "";
      roleBadge.style.display = "none";
    }
  }
  // Moderators and the admin can open this screen to read reports.
  // Only the admin sees the moderator management tools on it.
  if (navAdminBtn) navAdminBtn.style.display = isModeratorOrAdmin() ? "inline-block" : "none";
  if (moderatorTools) moderatorTools.style.display = isAdmin() ? "block" : "none";
}

// ============================================================
// Light / dark mode
// The page picks a mode before it paints (see the small script in index.html).
// The choice is saved on the user's profile so it follows them to other devices,
// and in this browser so the page looks right the moment it opens.
// ============================================================
const THEME_STORAGE_KEY = "study-notes-theme"; // must match the script in index.html
const themeToggleBtn = document.getElementById("theme-toggle-btn");

function getCurrentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function renderThemeButton() {
  if (!themeToggleBtn) return;
  const isDark = getCurrentTheme() === "dark";
  themeToggleBtn.innerText = isDark ? "☀️ Light" : "🌙 Dark";
  themeToggleBtn.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
}

function applyTheme(theme) {
  const chosen = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", chosen);
  try { localStorage.setItem(THEME_STORAGE_KEY, chosen); } catch (e) { /* storage may be blocked */ }
  renderThemeButton();
}

// Load the signed-in user's saved choice. This never blocks sign-in: if the
// theme column is missing or the lookup fails, the current look is kept.
async function loadSavedTheme() {
  if (!currentUser) return;
  try {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("theme")
      .eq("id", currentUser.id)
      .maybeSingle();
    if (error || !data) return;
    if (data.theme === "light" || data.theme === "dark") applyTheme(data.theme);
  } catch (err) {
    console.warn("Could not load saved theme:", err);
  }
}

async function saveThemeToProfile(theme) {
  if (!currentUser) return;
  try {
    const { error } = await supabaseClient
      .from("profiles")
      .update({ theme: theme })
      .eq("id", currentUser.id);
    if (error) console.warn("Could not save theme to your profile:", error.message);
  } catch (err) {
    console.warn("Could not save theme to your profile:", err);
  }
}

renderThemeButton();

if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const next = getCurrentTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    saveThemeToProfile(next);
  });
}

// Application Initialization
// onAuthStateChange fires once on page load (INITIAL_SESSION) and again on every
// sign-in or sign-out, so it is the only listener needed. The setTimeout runs the
// profile lookup outside the callback, because awaiting a Supabase query inside
// onAuthStateChange can freeze the client.
function initApp() {
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => {
      handleAuthState(session).catch((err) => {
        showMsg(err.message || "Failed to initialize authentication.");
      });
    }, 0);
  });
}

// Handle Auth State Changes
async function handleAuthState(session) {
  clearMsg();

  if (!session) {
    currentUser = null;
    currentRole = 'user';
    updateRoleUI();
    if (navActions) navActions.style.display = "none";
    showScreen(authScreen);
    if (signedOutNotice) {
      showMsg(signedOutNotice, false);
      signedOutNotice = null;
    }
    return;
  }

  currentUser = session.user;
  if (navActions) navActions.style.display = "flex";

  // Read this user's username and role from the profiles table
  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('username, role')
    .eq('id', currentUser.id)
    .maybeSingle();

  if (error) {
    // Show the real database error instead of hiding it behind the username screen
    showMsg(`Error loading profile: ${error.message}`);
    showScreen(usernameScreen);
    return;
  }

  // Apply this user's saved light/dark choice (does nothing if they have not picked one)
  await loadSavedTheme();

  if (!profile || !profile.username) {
    currentRole = (profile && profile.role) || 'user';
    updateRoleUI();
    showScreen(usernameScreen);
    return;
  }

  currentRole = profile.role || 'user';
  updateRoleUI();
  if (userDisplay) userDisplay.innerText = `@${profile.username}`;

  // Hide password change box for GitHub users
  if (currentUser.app_metadata && currentUser.app_metadata.provider === "github") {
    if (changePasswordBox) changePasswordBox.style.display = "none";
  } else {
    if (changePasswordBox) changePasswordBox.style.display = "block";
  }

  // Stay on Settings or Admin if the user is already there (for example after a token refresh)
  const onSettings = settingsScreen && settingsScreen.classList.contains("active");
  const onAdmin = adminScreen && adminScreen.classList.contains("active");
  const onPrivacy = privacyScreen && privacyScreen.classList.contains("active");
  if (!onSettings && !onPrivacy && !(onAdmin && isModeratorOrAdmin())) {
    showScreen(dashboardScreen);
    loadDashboardNotes();
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
      authToggleLink.innerText = "Sign In";
      if (passwordHint) passwordHint.style.display = "block";
    } else {
      if (authTitle) authTitle.innerText = "Sign In";
      if (authSubmitBtn) authSubmitBtn.innerText = "Sign In";
      if (authToggleText) authToggleText.innerText = "Don't have an account?";
      authToggleLink.innerText = "Sign Up";
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
        // Switch back to Sign In mode first, because the toggle clears the message
        authToggleLink.click();
        showMsg("Account created successfully! You can now sign in.", false);
      }
    } else {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) showMsg(error.message);
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
        redirectTo: window.location.origin + window.location.pathname
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

    const username = usernameField.value.trim();
    if (!username) return;

    // Check if the username is already taken by someone else
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

    // Save the profile row. The role column is NOT sent: the database sets it.
    const { data: savedRows, error } = await supabaseClient
      .from("profiles")
      .upsert({ id: currentUser.id, username: username })
      .select("username, role");

    if (error) {
      showMsg(error.message.includes("unique") ? "Username is already taken. Please try another." : error.message);
      return;
    }

    if (!savedRows || savedRows.length === 0) {
      showMsg("The username was sent, but the profiles table did not return it. Run the Supabase setup script again.");
      return;
    }

    currentRole = savedRows[0].role || 'user';
    updateRoleUI();
    if (userDisplay) userDisplay.innerText = `@${username}`;
    showMsg("Username saved successfully!", false);
    showScreen(dashboardScreen);
    loadDashboardNotes();
  });
}

// Navigation Listeners
if (navDashboardBtn) {
  navDashboardBtn.addEventListener("click", () => {
    clearMsg();
    showScreen(dashboardScreen);
    loadDashboardNotes();
  });
}

if (navSettingsBtn) {
  navSettingsBtn.addEventListener("click", () => {
    clearMsg();
    showScreen(settingsScreen);
  });
}

if (navAdminBtn) {
  navAdminBtn.addEventListener("click", () => {
    if (!isModeratorOrAdmin()) return;
    clearMsg();
    showScreen(adminScreen);
    if (isAdmin()) loadAdminUsers();
    loadReports();
  });
}

// Privacy Policy page: open from the footer link, return with the Back button
if (privacyLink) {
  privacyLink.addEventListener("click", (e) => {
    e.preventDefault();
    if (!privacyScreen || privacyScreen.classList.contains("active")) return;

    // Remember which screen the person was on
    const screens = [authScreen, usernameScreen, dashboardScreen, settingsScreen, adminScreen];
    screenBeforePrivacy = screens.find((s) => s && s.classList.contains("active")) || authScreen;

    clearMsg();
    showScreen(privacyScreen);
    window.scrollTo(0, 0);
  });
}

if (privacyBackBtn) {
  privacyBackBtn.addEventListener("click", () => {
    showScreen(screenBeforePrivacy || authScreen);
    window.scrollTo(0, 0);
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

    const newPasswordField = document.getElementById("new-password");
    const newPassword = newPasswordField.value;

    if (!validatePassword(newPassword)) {
      showMsg("Password must be at least 8 characters long and contain at least 1 uppercase letter, 1 lowercase letter, and 1 number.");
      return;
    }

    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
    if (error) {
      showMsg(error.message);
    } else {
      showMsg("Password updated successfully!", false);
      newPasswordField.value = "";
    }
  });
}

// ============================================================
// Delete my data: removes the user's files, rows and account
// ============================================================
function showDeleteDataMsg(text) {
  if (!deleteDataMsg) return;
  deleteDataMsg.innerText = text;
  deleteDataMsg.classList.toggle("active", !!text);
}

function openDeleteDataModal() {
  if (!currentUser) return;
  if (deleteDataConfirmField) deleteDataConfirmField.value = "";
  if (confirmDeleteDataBtn) {
    confirmDeleteDataBtn.disabled = true;
    confirmDeleteDataBtn.innerText = "Delete everything";
  }
  if (cancelDeleteDataBtn) cancelDeleteDataBtn.disabled = false;
  showDeleteDataMsg("");
  if (deleteDataModal) deleteDataModal.classList.add("active");
  if (deleteDataConfirmField) deleteDataConfirmField.focus();
}

function closeDeleteDataModal() {
  if (isDeletingData) return; // do not close while deleting
  if (deleteDataModal) deleteDataModal.classList.remove("active");
}

// Collect every file path that belongs to this user in the bucket
async function collectUserFilePaths(userId) {
  const paths = new Set();

  // 1. Paths saved on the user's notes
  const { data: notes, error: notesError } = await supabaseClient
    .from("study_notes")
    .select("file_url")
    .eq("user_id", userId);
  if (notesError) throw new Error(`Could not read your notes: ${notesError.message}`);
  (notes || []).forEach((n) => { if (n.file_url) paths.add(n.file_url); });

  // 2. Anything else in the user's own folder (for example a file left behind by a failed upload)
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const { data: files, error: listError } = await supabaseClient.storage
      .from(BUCKET_NAME)
      .list(userId, { limit: pageSize, offset: offset });
    if (listError) throw new Error(`Could not list your files: ${listError.message}`);
    if (!files || files.length === 0) break;
    files.forEach((f) => { if (f.id) paths.add(`${userId}/${f.name}`); });
    if (files.length < pageSize) break;
  }

  return Array.from(paths);
}

async function deleteAllMyData() {
  const userId = currentUser.id;

  // Step 1: delete the files first (the database step removes the records that point to them)
  const paths = await collectUserFilePaths(userId);
  const chunkSize = 100;
  for (let i = 0; i < paths.length; i += chunkSize) {
    const chunk = paths.slice(i, i + chunkSize);
    const { error: removeError } = await supabaseClient.storage.from(BUCKET_NAME).remove(chunk);
    if (removeError) throw new Error(`Could not delete your files: ${removeError.message}`);
  }

  // Step 2: delete the rows and the account through the delete_my_data database function
  const { error: rpcError } = await supabaseClient.rpc("delete_my_data");
  if (rpcError) throw new Error(`Could not delete your data: ${rpcError.message}`);
}

if (deleteDataBtn) {
  deleteDataBtn.addEventListener("click", openDeleteDataModal);
}

if (cancelDeleteDataBtn) {
  cancelDeleteDataBtn.addEventListener("click", closeDeleteDataModal);
}

// The red button only turns on once the person types DELETE
if (deleteDataConfirmField) {
  deleteDataConfirmField.addEventListener("input", () => {
    if (confirmDeleteDataBtn) {
      confirmDeleteDataBtn.disabled = deleteDataConfirmField.value.trim() !== "DELETE";
    }
  });
}

if (confirmDeleteDataBtn) {
  confirmDeleteDataBtn.addEventListener("click", async () => {
    if (!currentUser || isDeletingData) return;
    if (deleteDataConfirmField.value.trim() !== "DELETE") return;

    isDeletingData = true;
    confirmDeleteDataBtn.disabled = true;
    confirmDeleteDataBtn.innerText = "Deleting...";
    if (cancelDeleteDataBtn) cancelDeleteDataBtn.disabled = true;
    showDeleteDataMsg("");

    try {
      await deleteAllMyData();
    } catch (err) {
      isDeletingData = false;
      confirmDeleteDataBtn.innerText = "Delete everything";
      confirmDeleteDataBtn.disabled = false;
      if (cancelDeleteDataBtn) cancelDeleteDataBtn.disabled = false;
      showDeleteDataMsg(`${err.message || err} You can try again.`);
      return;
    }

    // Done. The account no longer exists, so clear the saved login on this device.
    isDeletingData = false;
    if (deleteDataModal) deleteDataModal.classList.remove("active");
    signedOutNotice = "Your data has been deleted.";
    await supabaseClient.auth.signOut({ scope: "local" });
  });
}

// ============================================================
// Admin Screen: list users, add and remove moderators
// ============================================================
async function loadAdminUsers() {
  if (!usersTableBody) return;

  const { data: users, error } = await supabaseClient
    .from("profiles")
    .select("id, username, role")
    .order("username", { ascending: true });

  if (error) {
    showMsg(`Error loading users: ${error.message}`);
    return;
  }

  if (!users || users.length === 0) {
    usersTableBody.innerHTML = `<tr><td colspan="3">No users yet.</td></tr>`;
    return;
  }

  usersTableBody.innerHTML = users.map((u) => {
    let actionHtml = "";
    if (u.role === "moderator") {
      actionHtml = `<button type="button" class="secondary small-btn" data-action="remove-moderator" data-username="${escapeHtml(u.username)}">Remove moderator</button>`;
    } else if (u.role === "user" && u.username) {
      actionHtml = `<button type="button" class="small-btn" data-action="make-moderator" data-username="${escapeHtml(u.username)}">Make moderator</button>`;
    }
    return `
      <tr>
        <td>${u.username ? '@' + escapeHtml(u.username) : '<em>no username yet</em>'}</td>
        <td><span class="role-pill role-${escapeHtml(u.role)}">${escapeHtml(u.role)}</span></td>
        <td>${actionHtml}</td>
      </tr>`;
  }).join("");
}

// Change a user's role through the admin-only database function set_user_role
async function setUserRole(username, newRole) {
  clearMsg();
  const { error } = await supabaseClient.rpc("set_user_role", {
    target_username: username,
    new_role: newRole
  });

  if (error) {
    showMsg(`Could not change role: ${error.message}`);
    return;
  }

  showMsg(newRole === "moderator" ? `@${username} is now a moderator.` : `@${username} is no longer a moderator.`, false);
  loadAdminUsers();
}

if (addModeratorForm) {
  addModeratorForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = moderatorUsernameField.value.trim().replace(/^@/, "");
    if (!username) return;
    await setUserRole(username, "moderator");
    moderatorUsernameField.value = "";
  });
}

if (usersTableBody) {
  usersTableBody.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const username = btn.dataset.username;
    if (btn.dataset.action === "make-moderator") setUserRole(username, "moderator");
    if (btn.dataset.action === "remove-moderator") setUserRole(username, "user");
  });
}

// ============================================================
// Dashboard
// ============================================================

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

// Upload Form Handler with Validation
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

    // 1. File type check
    const fileExt = file.name.split('.').pop().toLowerCase();
    const isMimeVideo = file.type.startsWith('video/');
    const isMimeAudio = file.type.startsWith('audio/');

    if (!ALLOWED_EXTENSIONS.includes(fileExt) && !isMimeVideo && !isMimeAudio) {
      showMsg("Invalid file type. Allowed formats: JPG, PNG, WEBP, GIF, video, audio, PDF, and Word (.docx).");
      return;
    }

    // 2. File size check (10MB limit)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      showMsg(`File size exceeds 10 MB limit. Your file is ${formatBytes(file.size)}.`);
      return;
    }

    // Storage path: [user id]/[timestamp]-[file name]
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${currentUser.id}/${Date.now()}-${cleanFileName}`;

    if (uploadBtn) uploadBtn.disabled = true;
    if (progressContainer) progressContainer.style.display = "block";
    if (uploadProgressBar) uploadProgressBar.removeAttribute("value"); // moving bar while uploading
    if (uploadProgressText) uploadProgressText.innerText = "Uploading...";

    try {
      const { error: uploadError } = await supabaseClient.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        showMsg(`Upload failed: ${uploadError.message}`);
        return;
      }

      // Save the record in the database
      const { error: dbError } = await supabaseClient
        .from("study_notes")
        .insert({
          user_id: currentUser.id,
          class_title: classTitle,
          topic_unit: topicUnit,
          description: description,
          file_url: filePath, // path of the file inside the bucket
          file_name: file.name,
          file_size: file.size,
          is_public: isPublic
        });

      if (dbError) {
        showMsg(`Failed to save record: ${dbError.message}`);
        // Remove the uploaded file so it is not left without a record
        await supabaseClient.storage.from(BUCKET_NAME).remove([filePath]);
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
      if (uploadProgressBar) uploadProgressBar.value = 0;
    }
  });
}

// Get a signed URL (1 hour) for a file in the private bucket
async function getFileAccessUrl(filePath) {
  if (!filePath) return "";

  const { data, error } = await supabaseClient.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, 3600);

  if (error || !data?.signedUrl) return "";
  return data.signedUrl;
}

// Load Dashboard Items
async function loadDashboardNotes() {
  if (!currentUser) return;

  // Usernames for the "Uploaded by" line
  const { data: profiles, error: profilesError } = await supabaseClient
    .from("profiles")
    .select("id, username");
  if (profilesError) showMsg(`Error loading profiles: ${profilesError.message}`);

  const profileMap = {};
  if (profiles) profiles.forEach((p) => { profileMap[p.id] = p.username; });

  // Public notes
  const { data: publicNotes, error: publicError } = await supabaseClient
    .from("study_notes")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false });
  if (publicError) showMsg(`Error loading public materials: ${publicError.message}`);

  // This user's private notes
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

// Build the preview for a file based on its extension
function buildMediaMarkup(fileUrl, fileName) {
  if (!fileUrl) {
    return `<p class="file-size">File preview unavailable.</p>`;
  }

  const ext = (fileName || '').split('.').pop().toLowerCase();

  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
    return `
      <div class="media-preview">
        <img src="${escapeHtml(fileUrl)}" alt="${escapeHtml(fileName)}" loading="lazy">
      </div>`;
  }

  if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) {
    return `
      <div class="media-preview">
        <video controls preload="metadata">
          <source src="${escapeHtml(fileUrl)}">
          Your browser does not support video playback.
        </video>
      </div>`;
  }

  if (['mp3', 'wav'].includes(ext)) {
    return `
      <div class="media-preview">
        <audio controls preload="metadata">
          <source src="${escapeHtml(fileUrl)}">
          Your browser does not support audio playback.
        </audio>
      </div>`;
  }

  // PDF and Word documents
  return `
    <div style="margin-bottom: 0.75rem;">
      <a href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener noreferrer" class="file-link">
        📄 View / Download ${escapeHtml(fileName || 'Document')}
      </a>
    </div>`;
}

// Render Note Cards
async function renderNotes(notes, container, profileMap) {
  if (notes.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem; grid-column: 1 / -1;">No materials found.</p>`;
    return;
  }

  const cardsHtml = await Promise.all(notes.map(async (note) => {
    const isOwner = note.user_id === currentUser.id;
    // Owners can delete their own notes; moderators and the admin can delete any public note
    const canDelete = isOwner || (note.is_public && isModeratorOrAdmin());
    const deleteLabel = isOwner ? "Delete" : "Remove (moderator)";

    const author = profileMap[note.user_id] ? `@${profileMap[note.user_id]}` : "Unknown";
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
            ${fileUrl ? `
              <a href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
                <button type="button" class="secondary small-btn">Open File</button>
              </a>` : ''}
            ${!isOwner ? `
              <button type="button" class="secondary small-btn" data-action="report-post" data-target-id="${escapeHtml(note.id)}" data-target-label="${escapeHtml(note.topic_unit)}">Report Post</button>
              <button type="button" class="secondary small-btn" data-action="report-user" data-target-id="${escapeHtml(note.user_id)}" data-target-label="${escapeHtml(author)}">Report User</button>
            ` : ''}
            ${canDelete ? `
              <button type="button" class="danger small-btn" data-action="delete-note" data-note-id="${escapeHtml(note.id)}" data-file-path="${escapeHtml(note.file_url)}">${deleteLabel}</button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }));

  container.innerHTML = cardsHtml.join('');
}

// Delete buttons on note cards (one listener per list)
[publicNotesList, privateNotesList].forEach((list) => {
  if (!list) return;
  list.addEventListener("click", (e) => {
    const reportBtn = e.target.closest("button[data-action='report-post'], button[data-action='report-user']");
    if (reportBtn) {
      const type = reportBtn.dataset.action === "report-post" ? "post" : "user";
      openReportModal(type, reportBtn.dataset.targetId, reportBtn.dataset.targetLabel);
      return;
    }

    const btn = e.target.closest("button[data-action='delete-note']");
    if (!btn) return;
    openDeleteModal(btn.dataset.noteId, btn.dataset.filePath);
  });
});

// Open Delete Confirmation Modal
function openDeleteModal(noteId, filePath) {
  noteToDeleteId = noteId;
  noteToDeleteFilePath = filePath;
  if (deleteModal) deleteModal.classList.add("active");
}

// Close Delete Confirmation Modal
function closeDeleteModal() {
  noteToDeleteId = null;
  noteToDeleteFilePath = null;
  if (deleteModal) deleteModal.classList.remove("active");
}

if (cancelDeleteBtn) {
  cancelDeleteBtn.addEventListener("click", closeDeleteModal);
}

// Confirm Delete: remove the file first, then the database record.
// (Moderator permission on the file depends on the note record still existing.)
if (confirmDeleteBtn) {
  confirmDeleteBtn.addEventListener("click", async () => {
    if (!noteToDeleteId) return;
    clearMsg();

    if (noteToDeleteFilePath) {
      const { error: storageError } = await supabaseClient.storage
        .from(BUCKET_NAME)
        .remove([noteToDeleteFilePath]);
      if (storageError) console.warn("File removal problem:", storageError.message);
    }

    const { data: deletedRows, error: dbError } = await supabaseClient
      .from("study_notes")
      .delete()
      .eq("id", noteToDeleteId)
      .select("id");

    if (dbError) {
      showMsg(`Failed to delete record: ${dbError.message}`);
    } else if (!deletedRows || deletedRows.length === 0) {
      showMsg("You do not have permission to delete this material.");
    } else {
      showMsg("Material deleted successfully.", false);
      loadDashboardNotes();
    }

    closeDeleteModal();
  });
}

// Make text safe to put inside HTML
function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (m) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

// ============================================================
// Reports: the popup students use to report a post or a user
// ============================================================
function showReportModalMsg(text) {
  if (!reportModalMsg) return;
  reportModalMsg.innerText = text;
  reportModalMsg.classList.toggle("active", !!text);
}

function openReportModal(targetType, targetId, targetLabel) {
  if (!currentUser) return;
  reportTargetType = targetType;
  reportTargetId = targetId;
  if (reportModalTitle) {
    reportModalTitle.innerText = targetType === "post"
      ? `Report post: ${targetLabel || ""}`
      : `Report user: ${targetLabel || ""}`;
  }
  if (reportReasonField) reportReasonField.value = "";
  if (reportCharCount) reportCharCount.innerText = "0";
  showReportModalMsg("");
  if (submitReportBtn) submitReportBtn.disabled = false;
  if (reportModal) reportModal.classList.add("active");
  if (reportReasonField) reportReasonField.focus();
}

function closeReportModal() {
  reportTargetType = null;
  reportTargetId = null;
  if (reportModal) reportModal.classList.remove("active");
}

if (reportReasonField) {
  reportReasonField.addEventListener("input", () => {
    if (reportCharCount) reportCharCount.innerText = String(reportReasonField.value.length);
  });
}

if (cancelReportBtn) {
  cancelReportBtn.addEventListener("click", closeReportModal);
}

if (submitReportBtn) {
  submitReportBtn.addEventListener("click", async () => {
    if (!currentUser || !reportTargetType || !reportTargetId) return;

    const reason = reportReasonField.value.trim();
    if (!reason) {
      showReportModalMsg("Please tell us why you are reporting this.");
      return;
    }

    submitReportBtn.disabled = true;
    showReportModalMsg("");

    const { error } = await supabaseClient
      .from("reports")
      .insert({
        reporter_id: currentUser.id,
        target_type: reportTargetType,
        target_id: reportTargetId,
        reason: reason
      });

    if (error) {
      submitReportBtn.disabled = false;
      if (error.code === "23505") {
        showReportModalMsg("You have already reported this.");
      } else {
        console.error("Report error:", error);
        showReportModalMsg(`Could not submit your report: ${error.message}`);
      }
      return;
    }

    closeReportModal();
    showMsg("Report submitted. A moderator will review it.", false);
  });
}

// ============================================================
// Reports: the list moderators and the admin read
// ============================================================
async function loadReports() {
  if (!reportsList || !isModeratorOrAdmin()) return;

  reportsList.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.75rem;">Loading reports...</p>`;

  const { data: reports, error } = await supabaseClient
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    reportsList.innerHTML = "";
    showMsg(`Error loading reports: ${error.message}`);
    return;
  }

  if (!reports || reports.length === 0) {
    reportsList.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.75rem;">No reports yet.</p>`;
    return;
  }

  // Usernames for reporters and reported users
  const { data: profiles } = await supabaseClient.from("profiles").select("id, username");
  const nameMap = {};
  if (profiles) profiles.forEach((p) => { nameMap[p.id] = p.username; });
  const nameOf = (id) => (nameMap[id] ? `@${nameMap[id]}` : "Unknown user");

  // The posts that were reported
  const postIds = reports.filter((r) => r.target_type === "post").map((r) => r.target_id);
  const noteMap = {};
  if (postIds.length > 0) {
    const { data: notes } = await supabaseClient
      .from("study_notes")
      .select("id, user_id, class_title, topic_unit, file_url, file_name")
      .in("id", postIds);
    if (notes) notes.forEach((n) => { noteMap[n.id] = n; });
  }

  const itemsHtml = await Promise.all(reports.map(async (r) => {
    const when = new Date(r.created_at).toLocaleString();
    let targetHtml = "";

    if (r.target_type === "user") {
      targetHtml = `<div class="report-line">Reported user: <strong>${escapeHtml(nameOf(r.target_id))}</strong></div>`;
    } else {
      const note = noteMap[r.target_id];
      if (!note) {
        targetHtml = `<div class="report-line">Reported post: <em>no longer available (it may have been deleted)</em></div>`;
      } else {
        const fileUrl = await getFileAccessUrl(note.file_url);
        const fileName = note.file_name || note.file_url.split("/").pop();
        targetHtml = `
          <div class="report-line">Reported post: <strong>${escapeHtml(note.topic_unit)}</strong> (${escapeHtml(note.class_title)})</div>
          <div class="report-line">Uploaded by ${escapeHtml(nameOf(note.user_id))}</div>
          ${fileUrl ? `<div class="report-line"><a href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener noreferrer" class="file-link">📄 Open ${escapeHtml(fileName)}</a></div>` : ""}`;
      }
    }

    return `
      <div class="report-item">
        <div class="report-head">
          <span class="report-type">${escapeHtml(r.target_type)} report</span>
          <span class="report-date">${escapeHtml(when)}</span>
        </div>
        <div class="report-line">Reported by <strong>${escapeHtml(nameOf(r.reporter_id))}</strong></div>
        <div class="report-reason">${escapeHtml(r.reason)}</div>
        ${targetHtml}
      </div>`;
  }));

  reportsList.innerHTML = itemsHtml.join("");
}

initApp();