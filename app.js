const SUPABASE_URL = ["https://", "cnjgoixunkygvwbuifiy", ".supabase.co"].join("");
const SUPABASE_KEY = "sb_publishable_llm2wWoQpOl3oj1xJFkRfA_Fd69Aj8J";

let authToken = null;
let isSignupMode = false;
let currentFamily = null;
let currentUser = null;
let studentsCache = [];
let assignmentsCache = [];
let submissionsCache = [];
let achievementsCache = [];

async function sbAuth(endpoint, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${endpoint}`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || data.message || "Authentication failed");
  return data;
}

async function sbQuery(table, { method = "GET", query = "", body = null, single = false } = {}) {
  const headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${authToken || SUPABASE_KEY}`,
    "Content-Type": "application/json"
  };
  if (method === "POST" || method === "PATCH") {
    headers["Prefer"] = "return=representation";
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query ? "?" + query : ""}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  const text = await res.text();
  let data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error((data && data.message) || "Database error");
  if (single && Array.isArray(data)) return data.at(0) || null;

  return data;
}

function switchAuthTab(role) {
  document.getElementById("authError").innerText = "";
  document.getElementById("tabParent").classList.toggle("active", role === "parent");
  document.getElementById("tabStudent").classList.toggle("active", role === "student");
  document.getElementById("parentAuthForm").classList.toggle("hidden", role !== "parent");
  document.getElementById("studentAuthForm").classList.toggle("hidden", role !== "student");
}

function toggleParentMode(e) {
  e.preventDefault();
  isSignupMode = !isSignupMode;
  document.getElementById("signupExtraFields").classList.toggle("hidden", !isSignupMode);
  document.getElementById("parentAuthTitle").innerText = isSignupMode ? "Create Free Academy Account" : "Parent / Administrator Login";
  document.getElementById("parentSubmitBtn").innerText = isSignupMode ? "Create Academy & Sign In" : "Sign In";
  document.getElementById("toggleAuthText").innerText = isSignupMode ? "Already have an account?" : "New traveling family?";
  document.getElementById("toggleAuthLink").innerText = isSignupMode ? "Sign In" : "Create Free Academy Account";
}

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function handleParentAuth() {
  const errEl = document.getElementById("authError");
  const btn = document.getElementById("parentSubmitBtn");
  if (errEl) errEl.innerText = "";

  const rawLogin = (document.getElementById("parentEmail").value || "").trim().toLowerCase();
  const password = document.getElementById("parentPassword").value || "";

  if (!rawLogin || !password) {
    if (errEl) errEl.innerText = "Please enter your email or User ID and password.";
    return;
  }

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Connecting...";
    }

    const aliasMap = JSON.parse(localStorage.getItem("gph_user_aliases") || "{}");
    let email = rawLogin;
    if (!rawLogin.includes("@")) {
      const cleanId = rawLogin.replace(/[^a-z0-9._-]/g, "");
      if (aliasMap[cleanId]) {
        email = aliasMap[cleanId];
      } else {
        const matchedProf = await sbQuery("profiles", { query: `role=eq.parent&select=*` }).catch(() => []);
        const found = Array.isArray(matchedProf)
          ? matchedProf.find(p => (p.short_username || "").toLowerCase() === cleanId)
          : null;
        email = found && found.login_email ? found.login_email : (cleanId + "@globalprephigh.org");
      }
    }

    if (isSignupMode) {
      const betaCode = (document.getElementById("betaAccessCode").value || "").trim().toUpperCase();
      if (betaCode !== "GPH2026") throw new Error("Private Beta Access Only: Enter a valid Founder Beta Code to register.");
      const legalAck = document.getElementById("legalAckCb");
      if (legalAck && !legalAck.checked) throw new Error("Please check the Home-Education Administrator acknowledgment box to continue.");
      const fullName = (document.getElementById("parentName").value || "").trim();
      const academyName = (document.getElementById("academyName").value || "").trim();
      if (!fullName || !academyName) throw new Error("Please enter your name and Academy name.");

      const authData = await sbAuth("signup", { email, password });
      const userObj = authData.user || authData;
      if (!userObj || !userObj.id) throw new Error("Check your email to confirm your account, or disable Email Confirmation in Supabase Auth settings.");
      if (authData.access_token) authToken = authData.access_token;

      const inviteCode = generateInviteCode();
      const famData = await sbQuery("families", {
        method: "POST",
        body: { family_name: academyName, invite_code: inviteCode },
        single: true
      });

      const profData = await sbQuery("profiles", {
        method: "POST",
        body: { user_id: userObj.id, family_id: famData.id, full_name: fullName, role: "parent" },
        single: true
      });

      currentFamily = famData;
      currentUser = profData;
      currentUser.email = email;
      await loadParentDashboard();
    } else {
      const authData = await sbAuth("token?grant_type=password", { email, password });
      authToken = authData.access_token;

      const profData = await sbQuery("profiles", {
        query: `id=eq.${authData.user.id}&select=*`,
        single: true
      });
      if (!profData) throw new Error("Profile not found for this account.");

      const famData = await sbQuery("families", {
        query: `id=eq.${profData.family_id}&select=*`,
        single: true
      });

      currentUser = profData;
      currentUser.email = email;
      localStorage.setItem("gph_last_parent_email", email);

      currentFamily = famData;
      await loadParentDashboard();
    }
  } catch (err) {
    if (errEl) errEl.innerText = err.message || "Sign in failed.";
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = isSignupMode ? "Create Academy & Sign In" : "Sign In";
    }
  }
}

function toggleAccountModal(show) {
  const modal = document.getElementById("accountModal");
  if (!modal) return;
  modal.classList.toggle("hidden", !show);
  modal.style.display = show ? "flex" : "none";
}

async function recoverParentPassword(e) {
  if (e) e.preventDefault();
  const raw = document.getElementById("parentEmail").value.trim().toLowerCase();
  if (!raw) return alert("Enter your Email Address (or short User ID) in the box above first, then click Forgot Password.");
  if (!raw.includes("@")) {
    return alert("Short User IDs (like '" + raw + "') do not have an inbox for password reset emails. Please sign in with your User ID or contact your academy administrator to reset it.");
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: raw })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.msg || data.error_description || "Could not send password reset email.");    }
    alert("Password reset email sent! Check your inbox.");
  } catch (err) {
    alert(err.message);
  }
}

async function updateParentCredentials(mode) {
  if (mode === "login") {
    const inputEl = document.getElementById("newParentLogin");
    let raw = (inputEl ? inputEl.value : "").trim().toLowerCase();
    if (!raw || (currentUser && raw === (currentUser.email || "").toLowerCase())) {
      const typed = prompt("Enter your desired Short User ID (e.g., doe or smithfamily):");
      if (!typed) return;
      raw = typed.trim().toLowerCase();
    }
    const cleanId = raw.replace(/[^a-z0-9._-]/g, "");
    if (cleanId.length < 3) return alert("Short User ID must be at least 3 letters or numbers (e.g., doe).");
    const activeEmail = (currentUser && currentUser.email) || localStorage.getItem("gph_last_parent_email") || "";
    if (!activeEmail) return alert("Please sign in with your email once first so we can link your Short User ID.");
    const aliasMap = JSON.parse(localStorage.getItem("gph_user_aliases") || "{}");
    aliasMap[cleanId] = activeEmail;
    localStorage.setItem("gph_user_aliases", JSON.stringify(aliasMap));
    if (inputEl) inputEl.value = "";
    return alert(`Short User ID "${cleanId}" saved! Next time you sign in on this device, just type "${cleanId}" and your password.`);
  }

  const pw = document.getElementById("newParentPassword").value;
  if (!pw || pw.length < 6) return alert("Password must be at least 6 characters.");
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ password: pw })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.msg || data.error_description || "Could not update password.");
    document.getElementById("newParentPassword").value = "";
    alert("Password updated successfully!");
  } catch (err) {
    alert(err.message);
  }
}

async function handleStudentLogin() {
  const errEl = document.getElementById("authError");
  errEl.innerText = "";
  const code = document.getElementById("stuInviteCode").value.trim().toUpperCase();
  const username = document.getElementById("stuUsername").value.trim().toLowerCase();
  const pin = document.getElementById("stuPin").value.trim();

  if (!code || !username || !pin) return (errEl.innerText = "Fill in Invite Code, Username, and PIN.");

  try {
    const fam = await sbQuery("families", {
      query: `invite_code=eq.${encodeURIComponent(code)}&select=*`,
      single: true
    });
    if (!fam) return (errEl.innerText = "Invalid Academy Invite Code.");

    const stu = await sbQuery("profiles", {
      query: `family_id=eq.${fam.id}&username=eq.${encodeURIComponent(username)}&pin=eq.${encodeURIComponent(pin)}&role=eq.student&select=*`,
      single: true
    });
    if (!stu) return (errEl.innerText = "Incorrect Username or PIN.");

        currentFamily = fam;
    currentUser = stu;
    await loadStudentDashboard();
  } catch (err) {
    errEl.innerText = err.message;
  }
}

function saveSession(role) {
  const payload = JSON.stringify({ role, authToken, currentFamily, currentUser });
  const rememberEl = document.getElementById(role === "parent" ? "rememberParentCb" : "rememberStudentCb");
  if (rememberEl && !rememberEl.checked) {
    localStorage.removeItem("gph_session");
    localStorage.removeItem("gph_saved_creds");
    sessionStorage.setItem("gph_session", payload);
  } else {
    sessionStorage.removeItem("gph_session");
    localStorage.setItem("gph_session", payload);
    const creds = JSON.parse(localStorage.getItem("gph_saved_creds") || "{}");
    if (role === "parent") {
      const pe = document.getElementById("parentEmail");
      if (pe && pe.value.trim()) creds.parentEmail = pe.value.trim();
    } else {
      const sc = document.getElementById("stuInviteCode");
      const su = document.getElementById("stuUsername");
      if (sc && sc.value.trim()) creds.stuInviteCode = sc.value.trim().toUpperCase();
      if (su && su.value.trim()) creds.stuUsername = su.value.trim();
    }
    localStorage.setItem("gph_saved_creds", JSON.stringify(creds));
  }
}

function logout() {
  localStorage.removeItem("gph_session");
  sessionStorage.removeItem("gph_session");
  location.reload();
}


async function loadParentDashboard() {
  saveSession("parent");
  document.getElementById("authSection").classList.add("hidden");
  document.getElementById("parentDashboard").classList.remove("hidden");
  document.getElementById("logoutBtn").classList.remove("hidden");
    const acctBtn = document.getElementById("accountSettingsBtn");
  if (acctBtn) acctBtn.classList.remove("hidden");
  
  document.getElementById("dashAcademyName").innerText = currentFamily.family_name;
  document.getElementById("dashInviteCode").innerText = currentFamily.invite_code;

  ["q1s","q1e","q2s","q2e","q3s","q3e","q4s","q4e"].forEach(id => {
    const map = {q1s:"q1_start",q1e:"q1_end",q2s:"q2_start",q2e:"q2_end",q3s:"q3_start",q3e:"q3_end",q4s:"q4_start",q4e:"q4_end"};
    if (currentFamily[map[id]]) document.getElementById(id).value = currentFamily[map[id]];
  });

  await refreshFamilyData();
  populateCurriculumDropdown();
}

function showParentView(viewName, btn) {
  document.querySelectorAll(".p-view").forEach(el => el.classList.add("hidden"));
  document.getElementById("pView-" + viewName).classList.remove("hidden");
  document.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  if (viewName === "transcript") renderOfficialRecords();
}

async function refreshFamilyData() {
  studentsCache = (await sbQuery("profiles", {
    query: `family_id=eq.${currentFamily.id}&role=eq.student&select=*`
  })) || [];

  assignmentsCache = (await sbQuery("assignments", {
    query: `family_id=eq.${currentFamily.id}&select=*&order=created_at.desc`
  })) || [];

  submissionsCache = (await sbQuery("submissions", { query: `select=*` })) || [];

  achievementsCache = (await sbQuery("achievements", {
    query: `family_id=eq.${currentFamily.id}&select=*&order=date_completed.desc`
  })) || [];

  renderStudents();
  renderGradingQueue();
  renderAchievements();
}

async function addStudent() {
  const full_name = document.getElementById("newStuName").value.trim();
  const grade_level = document.getElementById("newStuGrade").value;
  const expected_grad_year = parseInt(document.getElementById("newStuGradYear").value) || 2028;
  const username = document.getElementById("newStuUser").value.trim().toLowerCase();
  const pin = document.getElementById("newStuPin").value.trim();

  if (!full_name || !username || pin.length !== 4) return alert("Enter full name, username, and a 4-digit PIN.");

  try {
    await sbQuery("profiles", {
      method: "POST",
      body: { family_id: currentFamily.id, full_name, grade_level, expected_grad_year, username, pin, role: "student" }
    });
    document.getElementById("newStuName").value = "";
    document.getElementById("newStuUser").value = "";
    document.getElementById("newStuPin").value = "";
    await refreshFamilyData();
  } catch (err) {
    alert(err.message);
  }
}

function previewStudentPortal(stuId) {
  const stu = studentsCache.find(s => s.id === stuId);
  if (!stu) return;
  window.parentBackupUser = currentUser;
  currentUser = stu;
  document.getElementById("parentDashboard").classList.add("hidden");
  loadStudentDashboard(true);
}

function exitStudentPreview() {
  if (window.parentBackupUser) {
    currentUser = window.parentBackupUser;
    window.parentBackupUser = null;
    document.getElementById("studentDashboard").classList.add("hidden");
    const banner = document.getElementById("previewBanner");
    if (banner) banner.remove();
    loadParentDashboard();
  }
}

function renderStudents() {
  const list = document.getElementById("studentList");
  const selects = ["assignStudentSelect", "achStudentSelect", "transStudentSelect"];
  list.innerHTML = studentsCache.map(s => {
    const safeName = (s.full_name || "").replace(/'/g, "\\'");
    const safeGrade = (s.grade_level || "9th").replace(/'/g, "\\'");
    const safeUser = (s.username || "").replace(/'/g, "\\'");
    const safePin = (s.pin || "").replace(/'/g, "\\'");
    const gradVal = s.expected_grad_year || s.grad_year || "";
    return '<div class="item-card"><div><strong>' + s.full_name + '</strong> <span class="badge">' + s.grade_level + '</span><br><small class="muted">User: <code>' + s.username + '</code> &bull; PIN: <code>' + s.pin + '</code> &bull; Grad: ' + gradVal + '</small></div><div style="display:flex; gap:8px; margin-top:8px;"><button type="button" class="btn-outline" style="width:auto; color:#1d4ed8; border-color:#bfdbfe; padding:5px 10px; font-size:12px;" onclick="previewStudentPortal(\'' + s.id + '\')">👀 Preview</button><button type="button" class="btn-outline" style="width:auto; color:#1e293b; padding:5px 10px; font-size:12px;" onclick="editStudent(\'' + s.id + '\',\'' + safeName + '\',\'' + safeGrade + '\',\'' + safeUser + '\',\'' + safePin + '\',\'' + gradVal + '\')">✏️ Edit</button><button type="button" class="btn-outline" style="width:auto; color:#b91c1c; border-color:#fecaca; padding:5px 10px; font-size:12px;" onclick="deleteStudent(\'' + s.id + '\',\'' + safeName + '\')">🗑️</button></div></div>';
  }).join("") || "<p class='muted'>No students enrolled yet.</p>";

  const options = studentsCache.map(s => '<option value="' + s.id + '">' + s.full_name + ' (' + s.grade_level + ')</option>').join("");
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = options;
  });
}

async function editStudent(id, oldName, oldGrade, oldUser, oldPin, oldGrad) {
  const full_name = prompt("Edit Student Full Legal Name:", oldName);
  if (full_name === null) return;
  const grade_level = prompt("Edit Grade Level (9th, 10th, 11th, or 12th):", oldGrade);
  if (grade_level === null) return;
  const username = prompt("Edit Student Login Username:", oldUser);
  if (username === null) return;
  const pin = prompt("Edit 4-Digit Student PIN:", oldPin);
  if (pin === null) return;
  const grad_year = prompt("Edit Expected Graduation Year:", oldGrad);
  if (grad_year === null) return;
  try {
    await sbQuery("profiles", {
      method: "PATCH",
      query: `id=eq.${id}`,
      body: {
        full_name: full_name.trim() || oldName,
        grade_level: grade_level.trim() || oldGrade,
        username: username.trim().toLowerCase() || oldUser,
        pin: pin.trim() || oldPin,
        expected_grad_year: parseInt(grad_year, 10) || parseInt(oldGrad, 10) || 2028
      }
    });
    await refreshFamilyData();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteStudent(id, name) {
  if (!confirm(`Remove ${name} from your academy?`)) return;
  try {
    await sbQuery("profiles", { method: "DELETE", query: `id=eq.${id}` });
    await refreshFamilyData();
  } catch (err) {
    alert(err.message);
  }
}

async function saveQuarters() {
  try {
    const updates = {
      q1_start: document.getElementById("q1s").value || null,
      q1_end: document.getElementById("q1e").value || null,
      q2_start: document.getElementById("q2s").value || null,
      q2_end: document.getElementById("q2e").value || null,
      q3_start: document.getElementById("q3s").value || null,
      q3_end: document.getElementById("q3e").value || null,
      q4_start: document.getElementById("q4s").value || null,
      q4_end: document.getElementById("q4e").value || null
    };
    const updated = await sbQuery("families", {
      method: "PATCH",
      query: `id=eq.${currentFamily.id}`,
      body: updates,
      single: true
    });
    if (updated) currentFamily = updated;
    alert("Custom quarter dates saved!");
  } catch (err) {
    alert(err.message);
  }
}

function populateCurriculumDropdown() {
  const box = document.getElementById("electiveChecklist");
  if (!box) return;

  const fallbackElectives = [
    { subject: "Personal Financial Literacy & Investing", credits: 0.5 },
    { subject: "Stock Market, Equities & Wealth Strategy", credits: 0.5 },
    { subject: "Honors Economics & Global Markets", credits: 0.5 },
    { subject: "Computer Science & Web Coding", credits: 1.0 },
    { subject: "Travel Photography & Visual Storytelling", credits: 0.5 },
    { subject: "Studio Art & Design", credits: 0.5 },
    { subject: "Automotive & Applied Mechanics", credits: 0.5 },
    { subject: "Entrepreneurship & Remote Startup Lab", credits: 0.5 },
    { subject: "Marine Biology & Ocean Conservation", credits: 0.5 },
    { subject: "World Culinary Arts & Food Science", credits: 0.5 },
    { subject: "Psychology & Human Behavior", credits: 0.5 },
    { subject: "Public Speaking, Rhetoric & Debate", credits: 0.5 },
    { subject: "Digital Graphic Design & Brand Identity", credits: 0.5 },
    { subject: "Health, Nutrition & Travel First Aid", credits: 0.5 },
    { subject: "Architecture & Global Urban Design", credits: 0.5 }
  ];

    const coreNames = [
    "Honors English Literature", "Honors English Literature I (9th)", "Honors World Literature (10th)", "Honors American Literature (11th)", "Honors British & Global Literature (12th)",
    "Honors Algebra I", "Honors Algebra I (9th)", "Honors Geometry (10th)", "Honors Algebra II (11th)", "Honors Pre-Calculus & Statistics (12th)",
    "Honors Biology", "Honors Biology (9th)", "Honors Chemistry (10th)", "Honors Physics (11th)", "Honors Environmental & Marine Science (12th)",
    "Honors World History", "Honors World History (9th)", "Honors Modern World & U.S. History (10th)", "Honors U.S. History (11th)", "Honors U.S. Government & Macroeconomics (12th)"
  ];

  const langNames = ["Honors Mandarin Chinese I", "Honors Hindi I", "Honors Spanish I", "Honors French I"];

  let list = fallbackElectives;
  if (typeof HONORS_CURRICULUM !== "undefined" && Array.isArray(HONORS_CURRICULUM)) {
    const seen = new Set();
    const fromCurr = [];
    HONORS_CURRICULUM.forEach(m => {
      if (!coreNames.includes(m.subject) && !langNames.includes(m.subject) && !seen.has(m.subject)) {
        seen.add(m.subject);
        fromCurr.push({ subject: m.subject, credits: m.credits || 0.5 });
      }
    });
    if (fromCurr.length) list = fromCurr;
  }

  box.innerHTML = list.map(e =>
    '<label style="display:flex; align-items:center; gap:8px; padding:6px 8px; background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:4px; cursor:pointer;">' +
    '<input type="checkbox" class="course-pick-cb" value="' + e.subject + '" style="width:auto; margin:0;" />' +
    '<span style="flex:1; font-weight:600;">' + e.subject + '</span>' +
    '<small class="muted">' + e.credits + ' Cr</small>' +
    '</label>'
  ).join("");
}

async function enrollSelectedCourses() {
  const catalog = window.HONORS_CURRICULUM || (typeof HONORS_CURRICULUM !== "undefined" ? HONORS_CURRICULUM : []);
  if (!catalog.length) return alert("Course catalog is empty—please refresh the page once.");

  const student_id = document.getElementById("assignStudentSelect").value;
  const quarter = document.getElementById("assignQuarter").value;
  const langSubject = document.getElementById("assignLanguageSelect").value;
  const loc = document.getElementById("assignLocation").value.trim();
  const pickedElectives = Array.from(document.querySelectorAll(".course-pick-cb:checked")).map(cb => cb.value);

  if (!student_id) return alert("Please add or select a student first.");
  if (!pickedElectives.length) return alert("Please select at least 1 required elective before enrolling.");

  const stu = (studentsCache || []).find(s => s.id === student_id);
  const g = stu ? String(stu.grade_level) : "9th";

  let gradeTrack = [
    { base: "Honors English Literature", target: "Honors English Literature I (9th)" },
    { base: "Honors Algebra I", target: "Honors Algebra I (9th)" },
    { base: "Honors Biology", target: "Honors Biology (9th)" },
    { base: "Honors World History", target: "Honors World History (9th)" }
  ];

  if (g.startsWith("10")) {
    gradeTrack = [
      { base: "Honors English Literature", target: "Honors World Literature (10th)" },
      { base: "Honors Algebra I", target: "Honors Geometry (10th)" },
      { base: "Honors Biology", target: "Honors Chemistry (10th)" },
      { base: "Honors World History", target: "Honors Modern World & U.S. History (10th)" }
    ];
  } else if (g.startsWith("11")) {
    gradeTrack = [
      { base: "Honors English Literature", target: "Honors American Literature (11th)" },
      { base: "Honors Algebra I", target: "Honors Algebra II (11th)" },
      { base: "Honors Biology", target: "Honors Physics (11th)" },
      { base: "Honors World History", target: "Honors U.S. History (11th)" }
    ];
  } else if (g.startsWith("12")) {
    gradeTrack = [
      { base: "Honors English Literature", target: "Honors British & Global Literature (12th)" },
      { base: "Honors Algebra I", target: "Honors Pre-Calculus & Statistics (12th)" },
      { base: "Honors Biology", target: "Honors Environmental & Marine Science (12th)" },
      { base: "Honors World History", target: "Honors U.S. Government & Macroeconomics (12th)" }
    ];
  }

    const alreadyEnrolled = new Set(
    (assignmentsCache || [])
      .filter(a => a.student_id === student_id && a.quarter === quarter)
      .map(a => (a.subject || "").toLowerCase())
  );

  const rawCourses = [];
  gradeTrack.forEach(item => {
    const found = catalog.find(c => c.subject === item.target) || catalog.find(c => c.subject === item.base);
    if (found) rawCourses.push({ ...found, subject: item.target });
  });

  const extraSubjects = [langSubject, ...pickedElectives];
  extraSubjects.forEach(sub => {
    const found = catalog.find(c => c.subject === sub);
    if (found) rawCourses.push(found);
  });

  const coursesToEnroll = rawCourses.filter(c => !alreadyEnrolled.has((c.subject || "").toLowerCase()));

  if (!coursesToEnroll.length) {
    return alert(`${stu ? stu.full_name : "This student"} is already enrolled in all of those courses for ${quarter}!`);
  }

  try {
    for (const course of coursesToEnroll) {
      const m = Array.isArray(course.modules) ? course.modules : course;
      const titleText = loc ? `[${quarter} • ${loc}] ${m.title}` : `[${quarter}] ${m.title}`;
      await sbQuery("assignments", {
        method: "POST",
        body: {
          family_id: currentFamily.id,
          student_id,
          quarter,
          subject: course.subject,
          course_level: course.course_level || "Honors",
          credits: course.credits || 1.0,
          title: titleText,
          description: m.description || "",
          resource_url: m.resource_url || ""
        }
      });
    }
    alert(`Added ${coursesToEnroll.length} new course${coursesToEnroll.length > 1 ? "s" : ""} for ${stu ? stu.full_name : "student"} (skipped ${rawCourses.length - coursesToEnroll.length} already-enrolled courses).`);
    const drawer = document.getElementById("enrollmentDrawer");
    if (drawer) drawer.classList.add("hidden");
    setGradingStudentFilter(student_id);
    await refreshFamilyData();
  } catch (err) {
    alert(err.message);
  }
}


async function assignExtraPractice() {
  const student_id = document.getElementById("assignStudentSelect").value;
  const subject = document.getElementById("extraSubject").value.trim();
  const description = document.getElementById("extraDesc").value.trim();
  const quarter = document.getElementById("assignQuarter").value;
  if (!student_id || !subject || !description) return alert("Select a student and enter Subject and Instructions.");

  try {
    await sbQuery("assignments", {
      method: "POST",
      body: {
        family_id: currentFamily.id,
        student_id,
        subject,
        course_level: "Honors",
        quarter,
        credits: 0.0,
        title: "Extra Practice / Instructor Note",
        description
      }
    });
    document.getElementById("extraSubject").value = "";
    document.getElementById("extraDesc").value = "";
    await refreshFamilyData();
    alert("Extra practice added!");
  } catch (err) {
    alert(err.message);
  }
}

async function deleteAssignment(id) {
  if (!confirm("Remove this module from the student's course list?")) return;
  try {
    await sbQuery("submissions", { method: "DELETE", query: `assignment_id=eq.${id}` });
    await sbQuery("assignments", { method: "DELETE", query: `id=eq.${id}` });
    await refreshFamilyData();
  } catch (err) {
    alert(err.message);
  }
}

let activeGradingStudentId = null;

function setGradingStudentFilter(stuId) {
  activeGradingStudentId = stuId;
  const sel = document.getElementById("assignStudentSelect");
  if (sel && stuId && stuId !== "ALL") sel.value = stuId;
  renderGradingQueue();
}

function getParentTextSnippet(subject, dayNum) {
  const s = (subject || "").toLowerCase();
  const d = dayNum || 1;
  if (s.includes("algebra") || s.includes("math")) {
    return d === 1
      ? `<div style="font-weight:800; color:#14532d; margin-bottom:4px;">🌱 Recommended Extension &amp; Dinner-Table Prompt:</div><div style="margin-bottom:8px;">Compare two real-world cell phone or gym membership plans ($30/mo + $5/day vs. $50/mo flat) and ask your student at what day they cost the exact same amount.</div><div style="font-weight:800; color:#14532d; margin-bottom:4px;">✅ Step-by-Step Model Answer Key (Day 1):</div>• <b>Problem 1:</b> 24 ÷ 3 · 2 + (5 − 8)² = 8 · 2 + (−3)² = 16 + 9 = <b>25</b> (Watch out: dividing before multiplying left-to-right, and (−3)² = +9).<br>• <b>Problem 2:</b> 3(−2)² − 2(4) + 1 = 3(4) − 8 + 1 = 12 − 8 + 1 = <b>5</b>.<br>• <b>Problem 3:</b> 5(3x − 2) − 2(4x − 7) = 15x − 10 − 8x + 14 = <b>7x + 4</b>.<br>• <b>Problem 4:</b> 6x − 11 = 37 → 6x = 48 → <b>x = 8</b> (Check: 6(8) − 11 = 37 ✓).<br>• <b>Problem 5:</b> 18v + 35 = 179 → 18v = 144 → <b>v = 8 visits</b>.<br>• <b>Global Explorer Bonus (+5%):</b> t = 450 ÷ 320 = <b>1.40625 hrs (1 hr 24 min)</b>.`
      : `<div style="font-weight:800; color:#14532d; margin-bottom:4px;">✅ Step-by-Step Model Answer Key (Day ${d} — Slope &amp; y = mx + b):</div>• <b>Problem 1:</b> m = (1900 − 400) ÷ (6 − 0) = 1500 ÷ 6 = <b>250 ft per mile</b> (steepness of climb).<br>• <b>Problem 2:</b> m = (−3 − 5) ÷ (6 − 2) = −8 ÷ 4 = <b>−2</b>.<br>• <b>Problem 3:</b> <b>y = 4x − 3</b>.<br>• <b>Problem 4:</b> <b>y = 8x + 25</b>; for 15 shirts: 8(15) + 25 = <b>$145</b>.<br>• <b>Problem 5 (Grid):</b> Plotted points (1, 2) and (4, 8) → m = 2, b = 0 → <b>y = 2x</b>.<br>• <b>Global Explorer Bonus (+5%):</b> <b>h = 6t</b> (passes through origin (0, 0)).`;
  }
  if (s.includes("biology")) {
    return d === 1
      ? `<div style="font-weight:800; color:#14532d; margin-bottom:4px;">🌱 Dinner-Table Discussion &amp; Lab Safety Check:</div><div style="margin-bottom:8px;">Ask: "Why did Alexander Fleming's contaminated petri dish lead to penicillin instead of the trash bin?" Ensure water for yeast is warm (~105°F), not boiling.</div><div style="font-weight:800; color:#14532d; margin-bottom:4px;">✅ Step-by-Step Model Answer Key (Day 1):</div>• <b>1. Hypothesis:</b> Must follow <i>"If water temperature increases, then goldfish gill/heart rate will increase because fish are ectothermic (cold-blooded) and metabolic enzyme rates rise with temperature."</i><br>• <b>2–3. Yeast Lab &amp; CER:</b> <b>IV:</b> Sugar amount (0, ½, 2 tsp) | <b>DV:</b> CO₂ foam height (mm) | <b>Control:</b> Cup 1 (0 tsp sugar, proves yeast needs sugar to produce significant CO₂) | <b>Constants:</b> Water volume (½ cup), temperature (~105°F), yeast amount (¾ tsp), cup size.<br>• <b>Global Explorer Bonus (+5%):</b> <b>Paris, France</b>.`
      : `<div style="font-weight:800; color:#14532d; margin-bottom:4px;">✅ Model Answer Key (Day ${d} — Cell Transport &amp; Osmosis):</div>• <b>CER Rubric:</b> Pure distilled water is <b>hypotonic</b> relative to red blood cells, causing water to rush inward via osmosis and burst cells (hemolysis). Isotonic 0.9% NaCl maintains osmotic equilibrium.<br>• <b>Global Explorer Bonus (+5%):</b> <b>London, England</b>.`;
  }
  if (s.includes("history")) {
    return d === 1
      ? `<div style="font-weight:800; color:#14532d; margin-bottom:4px;">🌱 Recommended Extension &amp; Dinner-Table Prompt:</div><div style="margin-bottom:8px;">Ask: "Why would a king carve laws onto a 7-foot stone in a public plaza if most citizens couldn't read cuneiform?" (Visual deterrence &amp; priestly/scribal public readings!).</div><div style="font-weight:800; color:#14532d; margin-bottom:4px;">✅ Step-by-Step Model Answer Key (Day 1):</div>• <b>1. Royal Judge Roleplay:</b> Noble vs. Freed Artisan → <b>Law 198: Noble pays 1 gold mina fine</b> (NOT eye-for-eye, which only applied between equals under Law 196!). Negligent Builder → <b>Law 229: Builder is put to death</b>.<br>• <b>2. Social Hierarchy Evaluation:</b> Strong Honors responses cite Laws 196–199 directly to show punishments protected class hierarchy (Awilum &gt; Mushkenum &gt; Wardum) while still introducing early consumer protection (Law 229).<br>• <b>Global Explorer Bonus (+5%):</b> <b>The Louvre Museum</b> (Paris, France).`
      : `<div style="font-weight:800; color:#14532d; margin-bottom:4px;">✅ Model Answer Key (Day ${d} — Nile &amp; Indus Civilizations):</div>• <b>Rubric:</b> Contrast predictable Nile flooding &amp; centralized Pharaoh rule with Mesopotamia's unpredictable floods &amp; independent city-states, plus Indus urban grid planning.<br>• <b>Global Explorer Bonus (+5%):</b> <b>Rosetta (Rashid), Egypt</b>.`;
  }
  if (s.includes("literature") || s.includes("english")) {
    return `<div style="font-weight:800; color:#14532d; margin-bottom:4px;">✅ Honors Literature Grading Rubric (Day ${d}):</div>• <b>Strong Honors Mastery (95–100%):</b> Directly answers the prompt in 8–12 well-crafted sentences, cites at least 2 concrete textual details (e.g., Clarisse's dandelion/curiosity vs. Mildred's Seashells &amp; parlor walls, or Faber's 3 pillars), and connects Bradbury's 1953 warning to modern 2026 media.<br>• <b>Global Explorer Bonus (+5%):</b> Day 1: Real censorship examples (e.g., 1967 Ballantine expurgated edition, apartheid South Africa, or local U.S. school board challenges) | Day 2: <b>Alexandria, Egypt</b> | Day 3+: <b>Stockholm, Sweden</b>.`;
  }
  if (s.includes("marine")) {
    return `<div style="font-weight:800; color:#14532d; margin-bottom:4px;">✅ Marine Biology Answer Key &amp; Lab Rubric (Day ${d}):</div>• <b>35 ppt Seawater Lab:</b> Higher dissolved salt increases water density, causing the egg/grape to float highest in 35 ppt seawater, moderately in 15 ppt brackish water, and sink in 0 ppt freshwater.<br>• <b>Coral Bleaching:</b> Warming ocean temperatures stress corals into expelling photosynthetic <b>zooxanthellae</b> algae, depriving corals of up to 90% of their energy.<br>• <b>Global Explorer Bonus (+5%):</b> Day 1: <b>Australia</b> (Great Barrier Reef) | Day 2+: <b>Mariana Trench</b>.`;
  }
  if (s.includes("stock") || s.includes("finance")) {
    return `<div style="font-weight:800; color:#14532d; margin-bottom:4px;">✅ Stock Market &amp; Investing Answer Key (Day ${d}):</div>• <b>Rubric:</b> Student correctly identifies 3 real stock ticker symbols (e.g., AAPL, MSFT, COST) and explains that an <b>S&amp;P 500 Index Fund</b> diversifies across 500 companies so one company's drop cannot wipe out their portfolio.<br>• <b>Global Explorer Bonus (+5%):</b> <b>Wall Street</b> (Lower Manhattan, New York City).`;
  }
  return `<div style="font-weight:800; color:#14532d; margin-bottom:4px;">✅ World Language Immersion Rubric (Day ${d}):</div>• <b>Rubric:</b> Complete 8–10 line dialogue using taught greetings, polite requests (<i>Quisiera..., por favor</i>), food/drink nouns, and closing thanks (<i>La cuenta, por favor. Muchas gracias</i>).<br>• <b>Global Explorer Bonus (+5%):</b> <b>Quito, Ecuador</b> (2,850 m elevation in the Andes).`;
}

function renderGradingQueue() {
  const pillsEl = document.getElementById("gradingStudentPills");
  if (pillsEl) {
    if (activeGradingStudentId === null && studentsCache.length) {
      activeGradingStudentId = studentsCache[0].id;
    }
        pillsEl.style.alignItems = "center";
    pillsEl.innerHTML = studentsCache.map(s => {
      const isAct = s.id === activeGradingStudentId;
      const btnStyle = isAct
        ? "width:auto; padding:10px 18px; font-size:17px; font-weight:800; background:#1e3a8a; color:#ffffff; border:2px solid #0f172a; box-shadow:0 3px 8px rgba(30,58,138,0.25);"
        : "width:auto; padding:8px 14px; font-size:14px; font-weight:600; background:#f8fafc; color:#1e293b; border:1px solid #cbd5e1;";
      return '<button type="button" style="border-radius:8px; cursor:pointer; ' + btnStyle + '" onclick="setGradingStudentFilter(\'' + s.id + '\')">' + s.full_name + ' (' + s.grade_level + ')</button>';
    }).join("") + (studentsCache.length > 1 ? '<button type="button" style="border-radius:8px; cursor:pointer; ' + (activeGradingStudentId === 'ALL' ? 'width:auto; padding:10px 16px; font-size:16px; font-weight:800; background:#1e3a8a; color:#ffffff; border:2px solid #0f172a;' : 'width:auto; padding:8px 13px; font-size:14px; font-weight:600; background:#f8fafc; color:#1e293b; border:1px solid #cbd5e1;') + '" onclick="setGradingStudentFilter(\'ALL\')">All</button>' : '');
  }

      const container = document.getElementById("parentAssignmentList");
  const baseList = activeGradingStudentId === "ALL" || !activeGradingStudentId
    ? assignmentsCache
    : assignmentsCache.filter(a => String(a.student_id) === String(activeGradingStudentId));

  const byCourse = {};
  baseList.forEach(a => {
    const key = (a.student_id || "") + "::" + (a.subject || "Course");
    if (!byCourse[key]) byCourse[key] = [];
    byCourse[key].push(a);
  });

  if (!Object.keys(byCourse).length) {
    container.innerHTML = "<p class='muted'>No courses or assignments found for this student yet.</p>";
    return;
  }

  if (!window.activeParentCourseKey || !byCourse[window.activeParentCourseKey]) {
    container.style.display = "grid";
    container.style.gridTemplateColumns = "repeat(auto-fit, minmax(300px, 1fr))";
    container.innerHTML = Object.keys(byCourse).map(k => {
      const list = byCourse[k];
      const latest = list.at(-1) || list.at(0);
      const stu = studentsCache.find(s => String(s.id) === String(latest.student_id));
      const needsCount = list.filter(item => {
        const s = submissionsCache.find(x => String(x.assignment_id) === String(item.id));
        return s && s.status === "Submitted" && !s.grade;
      }).length;
      const safeK = k.replace(/'/g, "\\'");
      const safeSubj = (latest.subject || "").replace(/'/g, "\\'");
      const badge = needsCount > 0
        ? `<span style="background:#fef3c7; color:#b45309; padding:3px 10px; border-radius:999px; font-size:12px; font-weight:800;">⏳ ${needsCount} Ready to Grade</span>`
        : `<span style="background:#dcfce7; color:#15803d; padding:3px 10px; border-radius:999px; font-size:12px; font-weight:700;">Day ${list.length} Active</span>`;
      return `<div class="item-card" style="display:flex; flex-direction:column; justify-content:space-between; gap:10px; border-left:4px solid #1e3a8a;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
            <strong style="font-size:16px; color:#0f172a;">📘 ${latest.subject}</strong>
            ${badge}
          </div>
          <div class="muted" style="font-size:12.5px; margin-top:4px;">Student: <b>${stu ? stu.full_name : "Student"}</b> • ${latest.course_level || "Honors"} (${latest.credits || 1} cr) • ${list.length} Day(s)</div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="btn-primary" style="flex:1;" onclick="window.activeParentCourseKey='${safeK}'; renderGradingQueue();">📂 Open Assignments &amp; Keys (${list.length})</button>
          <button type="button" class="btn-outline" style="width:auto; color:#b91c1c; border-color:#fecaca;" onclick="deleteParentCourse('${latest.student_id}', '${safeSubj}')">Delete Course</button>
        </div>
      </div>`;
    }).join("");
    return;
  }
    const courseList = byCourse[window.activeParentCourseKey].slice().reverse();
  const sampleItem = courseList.at(0);
  container.style.display = "block";
  const headerBar = `<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid #cbd5e1;">
    <button type="button" class="btn-outline" style="width:auto; color:#0f172a; font-weight:700;" onclick="window.activeParentCourseKey=null; renderGradingQueue();">← All Courses</button>
    <strong style="font-size:16px; color:#1e3a8a;">📘 ${sampleItem.subject} — Assignments (Newest First)</strong>
  </div>`;

  container.innerHTML = headerBar + courseList.map((a, revIdx) => {
    const dayNum = courseList.length - revIdx;
    const sub = submissionsCache.find(s => String(s.assignment_id) === String(a.id));
    const gradeVal = sub && sub.grade ? sub.grade : "";
    const fbVal = sub && sub.parent_feedback ? sub.parent_feedback : "";
    const isGraded = !!(sub && (sub.status === "Graded" || String(gradeVal).trim() !== ""));
    const isSubmitted = !!(sub && sub.status === "Submitted" && !isGraded);
    const cleanTitle = a.title.replace(/^\[[^\]]+\]\s*/, "");
    const statusPill = isGraded
      ? `<span style="background:#dcfce7; color:#15803d; padding:3px 10px; border-radius:999px; font-size:12px; font-weight:800;">✅ Graded: ${gradeVal}</span>`
      : isSubmitted
        ? `<span style="background:#fef3c7; color:#b45309; padding:3px 10px; border-radius:999px; font-size:12px; font-weight:800;">⏳ Submitted — Ready to Grade</span>`
        : `<span style="background:#f1f5f9; color:#475569; padding:3px 10px; border-radius:999px; font-size:12px; font-weight:700;">Day ${dayNum} Active</span>`;
    const photoHtml = sub && sub.submission_link
      ? `<div style="margin-top:8px;"><button type="button" class="btn-outline" style="width:auto; background:#eff6ff; color:#1d4ed8; border-color:#93c5fd; font-size:12px; font-weight:700;" onclick="openStudentPhotoModal('${sub.id}')">📸 Open Student Uploaded Photo</button></div>`
      : "";
    const subWork = sub && (sub.student_notes || sub.submission_link)
      ? `<div style="background:#f8fafc; border:1px solid #cbd5e1; padding:10px; border-radius:8px; margin-top:8px; font-size:13px; white-space:pre-line;"><b>Student Submitted Work:</b>\n${sub.student_notes || "(Photo attached)"}${photoHtml}</div>`
      : `<div class="muted" style="font-size:12.5px; margin-top:8px;">Awaiting student submission.</div>`;
    const safeSubj = (a.subject || "").replace(/'/g, "\\'");

    return `<div class="item-card" style="margin-bottom:12px; border-left:4px solid ${isGraded ? "#16a34a" : isSubmitted ? "#f59e0b" : "#94a3b8"};">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px;">
        <div><span class="badge">Day ${dayNum}</span> <strong>${cleanTitle}</strong></div>
        ${statusPill}
      </div>
      <details style="margin-top:8px; border:1px solid #86efac; border-radius:8px; overflow:hidden;" ${revIdx === 0 ? "open" : ""}>
        <summary style="cursor:pointer; background:#14532d; color:#ffffff; padding:8px 12px; font-weight:700; font-size:13px;">🔑 Parent &amp; Instructor Companion Guide + Step-by-Step Answer Key (Day ${dayNum})</summary>
        <div style="padding:12px; background:#f0fdf4; font-size:13px; line-height:1.6; color:#1e293b;">${getParentTextSnippet(a.subject, dayNum)}</div>
      </details>
      ${subWork}
      <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap; align-items:center;">
        <input type="text" id="grade-${a.id}" value="${gradeVal}" placeholder="Score (e.g., 95 or 100)" style="width:130px; margin:0;" />
        <label style="font-size:12.5px; font-weight:700; color:#15803d; display:flex; align-items:center; gap:4px; margin:0;"><input type="checkbox" id="bonus-${a.id}" /> +5% Global Explorer Bonus</label>
        <input type="text" id="fb-${a.id}" value="${fbVal}" placeholder="Parent feedback..." style="flex:1; min-width:180px; margin:0;" />
      </div>
      <div style="display:flex; align-items:center; gap:10px; margin-top:8px;">
        <button type="button" class="btn-primary" style="width:auto;" onclick="saveGrade('${a.id}', '${a.student_id}', '${safeSubj}', ${dayNum})">${isGraded ? "🔄 Update Grade & Feedback" : "✅ Save Grade & Unlock Next Day"}</button>
        <span id="grade-saved-msg-${a.id}" style="font-size:13px; font-weight:800; color:#15803d;"></span>
      </div>
    </div>`;
  }).join("");
}
}
function openStudentPhotoModal(subId) {
  const sub = submissionsCache.find(s => String(s.id) === String(subId));
  const modal = document.getElementById("photoLightboxModal");
  const img = document.getElementById("photoLightboxImg");
  if (!sub || !sub.submission_link || !modal || !img) return alert("Photo not found.");
  img.src = sub.submission_link;
  modal.classList.remove("hidden");
}

async function deleteParentCourse(studentId, subject) {
  if (!confirm(`Delete "${subject}" and all its lessons for this student?`)) return;
  try {
    const matching = assignmentsCache.filter(a => String(a.student_id) === String(studentId) && a.subject === subject);
    for (const a of matching) {
      await sbQuery("submissions", { method: "DELETE", query: `assignment_id=eq.${a.id}` }).catch(() => null);
      await sbQuery("assignments", { method: "DELETE", query: `id=eq.${a.id}` });
    }
    window.activeParentCourseKey = null;
    await loadParentDashboard();
  } catch (err) { alert(err.message); }
}

async function saveGrade(assignment_id, student_id, subject, dayNum) {
  let rawGrade = document.getElementById("grade-" + assignment_id).value.trim().toUpperCase();
  const parent_feedback = document.getElementById("fb-" + assignment_id).value.trim();
  const bonusChecked = document.getElementById("bonus-" + assignment_id) && document.getElementById("bonus-" + assignment_id).checked;
  if (!rawGrade) return alert("Enter a score first (e.g., 95 or 100).");
  const numMatch = rawGrade.match(/^(\d+(?:\.\d+)?)/);
  const grade = (bonusChecked && numMatch) ? Math.min(105, parseFloat(numMatch.at(1)) + 5) + "%" : rawGrade;
  try {
    const existing = submissionsCache.find(s => String(s.assignment_id) === String(assignment_id));
    if (existing) {
      await sbQuery("submissions", { method: "PATCH", query: `id=eq.${existing.id}`, body: { grade, parent_feedback, status: "Graded" } });
    } else {
      await sbQuery("submissions", { method: "POST", body: { assignment_id, student_id, grade, parent_feedback, status: "Graded" } });
    }
    const subjRows = assignmentsCache.filter(a => String(a.student_id) === String(student_id) && a.subject === subject);
    if (subjRows.length <= (dayNum || 1) && subjRows.length < 45) {
      const nextDay = subjRows.length + 1;
      const tmpl = subjRows.at(0) || {};
      const topicHint = getKhanLessonContent(subject, nextDay, "").unitTitle.replace(/^UNIT\s*\d+\s*•\s*(?:CHAPTER|LESSON)\s*[\d.]+:\s*/i, "");
      await sbQuery("assignments", { method: "POST", body: { family_id: currentFamily.id, student_id, quarter: tmpl.quarter || "Q1", subject, course_level: tmpl.course_level || "Honors", credits: tmpl.credits || 1.0, title: `[Q1 • Day ${nextDay}] ${topicHint}`, description: `DAY ${nextDay} HONORS LESSON: Complete the textbook reading, video, instant quick check, and workbook prompts.`, resource_url: tmpl.resource_url || "" } }).catch(() => null);
    }
     alert("✅ Grade (" + grade + ") & feedback saved! Next day's lesson & answer key are now unlocked.");
    await loadParentDashboard();
  } catch (err) {
    alert(err.message);
  }
}

async function addAchievement() {
  const student_id = document.getElementById("achStudentSelect").value;
  const title = document.getElementById("achTitle").value.trim();
  const location = document.getElementById("achLocation").value.trim();
  const metric = document.getElementById("achMetric").value.trim();
  const notes = document.getElementById("achNotes").value.trim();
  if (!student_id || !title) return alert("Select a student and enter a title.");
  try {
    await sbQuery("achievements", { method: "POST", body: { family_id: currentFamily.id, student_id, title, location, metric, notes } });
    document.getElementById("achTitle").value = "";
    document.getElementById("achLocation").value = "";
    document.getElementById("achMetric").value = "";
    document.getElementById("achNotes").value = "";
    await loadParentDashboard();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteAchievement(id) {
  if (!confirm("Remove this certification/milestone from the student's record?")) return;

  try {
    await sbQuery("achievements", { method: "DELETE", query: `id=eq.${id}` });
    await loadParentDashboard();
  } catch (err) {
    alert(err.message);
  }
}

async function editAchievement(id, oldTitle, oldLoc, oldMetric) {
  const title = prompt("Edit Title / Credential:", oldTitle);
  if (title === null) return;
  const location = prompt("Edit Location / Organization:", oldLoc || "");
  if (location === null) return;
  const metric = prompt("Edit Hours / Cert # / Metric:", oldMetric || "");
  if (metric === null) return;
  try {
    await sbQuery("achievements", {
      method: "PATCH",
      query: `id=eq.${id}`,
      body: { title: title.trim() || oldTitle, location: location.trim(), metric: metric.trim() }
    });
    await loadParentDashboard();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteCourseAssignment(id) {
  if (!confirm("Remove this course from the student's transcript and active schedule?")) return;
  try {
    await sbQuery("assignments", { method: "DELETE", query: `id=eq.${id}` });
    await loadParentDashboard();
  } catch (err) {
    alert(err.message);
  }
}

async function editCourseAssignment(id, oldSubject, oldLevel, oldCredits) {
  const subject = prompt("Edit Course Name:", oldSubject);
  if (subject === null) return;
  const course_level = prompt("Edit Level (Honors, Regular, or AP):", oldLevel || "Honors");
  if (course_level === null) return;
  const creditsStr = prompt("Edit Credit Value (e.g., 1.0 or 0.5):", String(oldCredits || 1.0));
  if (creditsStr === null) return;
  try {
    await sbQuery("assignments", {
      method: "PATCH",
      query: `id=eq.${id}`,
      body: {
        subject: subject.trim() || oldSubject,
        course_level: course_level.trim() || oldLevel,
        credits: parseFloat(creditsStr) || oldCredits
      }
    });
    await loadParentDashboard();
  } catch (err) {
    alert(err.message);
  }
}

function renderAchievements() {
  const container = document.getElementById("parentAchievementList");
  container.innerHTML = achievementsCache.map(ac => {
    const stu = studentsCache.find(s => s.id === ac.student_id);
    const loc = ac.location ? " &bull; 📍 " + ac.location : "";
    const met = ac.metric ? " &bull; " + ac.metric : "";
    const safeTitle = (ac.title || "").replace(/'/g, "\\'");
    const safeLoc = (ac.location || "").replace(/'/g, "\\'");
    const safeMet = (ac.metric || "").replace(/'/g, "\\'");
    return '<div class="item-card" style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;"><div><strong>[' + ac.type + '] ' + ac.title + '</strong><br><small class="muted">' + (stu ? stu.full_name : "Student") + loc + met + '</small></div><div style="display:flex; gap:6px; flex-shrink:0;"><button type="button" class="btn-outline" style="width:auto; color:#1e293b; padding:4px 8px; font-size:12px;" onclick="editAchievement(\'' + ac.id + '\',\'' + safeTitle + '\',\'' + safeLoc + '\',\'' + safeMet + '\')">✏️ Edit</button><button type="button" class="btn-outline" style="width:auto; color:#b91c1c; border-color:#fecaca; padding:4px 8px; font-size:12px;" onclick="deleteAchievement(\'' + ac.id + '\')">🗑️ Remove</button></div></div>';
  }).join("") || "<p class='muted'>No travel study, certifications, or service logged yet.</p>";
}

async function deleteAchievement(id) {
  if (!confirm("Remove this certification/milestone from the student's record?")) return;
  try {
    await sbQuery("achievements", { method: "DELETE", query: `id=eq.${id}` });
    await refreshFamilyData();
    renderOfficialRecords();
  } catch (err) {
    alert(err.message);
  }
}

async function editAchievement(id, oldTitle, oldLoc, oldMetric) {
  const title = prompt("Edit Title / Credential:", oldTitle);
  if (title === null) return;
  const location = prompt("Edit Location / Organization:", oldLoc || "");
  if (location === null) return;
  const metric = prompt("Edit Hours / Cert # / Metric:", oldMetric || "");
  if (metric === null) return;
  try {
    await sbQuery("achievements", {
      method: "PATCH",
      query: `id=eq.${id}`,
      body: { title: title.trim() || oldTitle, location: location.trim(), metric: metric.trim() }
    });
    await refreshFamilyData();
    renderOfficialRecords();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteTranscriptCourse(studentId, subject, level) {
  if (!confirm(`Remove "${subject} (${level})" from this student's transcript and active schedule?`)) return;
  try {
    const matches = assignmentsCache.filter(a => a.student_id === studentId && a.subject === subject && a.course_level === level);
    for (const m of matches) {
      await sbQuery("assignments", { method: "DELETE", query: `id=eq.${m.id}` });
    }
    await refreshFamilyData();
    renderOfficialRecords();
  } catch (err) {
    alert(err.message);
  }
}

async function editTranscriptCourse(studentId, oldSubject, oldLevel, oldCredits) {
  const subject = prompt("Edit Course Name:", oldSubject);
  if (subject === null) return;
  const course_level = prompt("Edit Course Level (Honors, Regular, or AP):", oldLevel || "Honors");
  if (course_level === null) return;
  const creditsStr = prompt("Edit Credit Value (e.g., 1.0 or 0.5):", String(oldCredits || 1.0));
  if (creditsStr === null) return;
  try {
    const matches = assignmentsCache.filter(a => a.student_id === studentId && a.subject === oldSubject && a.course_level === oldLevel);
    for (const m of matches) {
      await sbQuery("assignments", {
        method: "PATCH",
        query: `id=eq.${m.id}`,
        body: {
          subject: subject.trim() || oldSubject,
          course_level: course_level.trim() || oldLevel,
          credits: parseFloat(creditsStr) || oldCredits
        }
      });
    }
    await refreshFamilyData();
    renderOfficialRecords();
  } catch (err) {
    alert(err.message);
  }
}


function parseGradePercent(g) {
  if (!g) return null;
  const clean = g.trim().toUpperCase().replace("%", "");
  if (!isNaN(parseFloat(clean))) return parseFloat(clean);
  const letterMap = { "A+": 98, "A": 95, "A-": 91.5, "B+": 88, "B": 85, "B-": 81.5, "C+": 78, "C": 75, "C-": 71.5, "D+": 68, "D": 65, "F": 55 };
  return letterMap[clean] !== undefined ? letterMap[clean] : null;
}

function percentToLetterAndPoints(pct) {
  if (pct >= 93) return { letter: "A", pts: 4.0 };
  if (pct >= 90) return { letter: "A-", pts: 3.7 };
  if (pct >= 87) return { letter: "B+", pts: 3.3 };
  if (pct >= 83) return { letter: "B", pts: 3.0 };
  if (pct >= 80) return { letter: "B-", pts: 2.7 };
  if (pct >= 77) return { letter: "C+", pts: 2.3 };
  if (pct >= 73) return { letter: "C", pts: 2.0 };
  if (pct >= 70) return { letter: "C-", pts: 1.7 };
  if (pct >= 67) return { letter: "D+", pts: 1.3 };
  if (pct >= 63) return { letter: "D", pts: 1.0 };
  return { letter: "F", pts: 0.0 };
}

function buildGoldGlobeSealSvg() {
  return '<svg width="110" height="110" viewBox="0 0 140 140" xmlns="http://w3.org" style="display:inline-block; vertical-align:middle;">' +
    '<defs>' +
      '<radialGradient id="oceanGrad" cx="38%" cy="35%" r="65%"><stop offset="0%" stop-color="#38bdf8"/><stop offset="55%" stop-color="#1d4ed8"/><stop offset="100%" stop-color="#0f172a"/></radialGradient>' +
      '<linearGradient id="ribbonGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0f172a"/><stop offset="50%" stop-color="#1e3a8a"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>' +
    '</defs>' +
    '<circle cx="70" cy="70" r="44" fill="url(#oceanGrad)" stroke="#d97706" stroke-width="2.5"/>' +
    '<path d="M46 46 Q56 40 62 50 T54 68 Q45 64 46 46 Z" fill="#86efac" opacity="0.85"/>' +
    '<path d="M74 42 Q88 38 94 52 T86 76 Q76 74 74 60 Z" fill="#86efac" opacity="0.85"/>' +
    '<path d="M58 76 Q70 74 74 88 T60 98 Q52 90 58 76 Z" fill="#86efac" opacity="0.85"/>' +
    '<ellipse cx="70" cy="70" rx="64" ry="20" transform="rotate(-18 70 70)" fill="none" stroke="#facc15" stroke-width="3.5"/>' +
    '<rect x="6" y="57" width="128" height="24" rx="5" transform="rotate(-18 70 70)" fill="url(#ribbonGrad)" stroke="#facc15" stroke-width="2"/>' +
    '<text x="70" y="73" transform="rotate(-18 70 70)" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="10.5" font-weight="bold" letter-spacing="1.2">GLOBALPREP HIGH</text>' +
    '<text x="70" y="128" text-anchor="middle" fill="#0f172a" font-family="Georgia, serif" font-size="9" font-weight="700" letter-spacing="1.4">HONORS ACADEMY</text>' +
  '</svg>';
}

function getCourseStandardTag(subj) {
  const s = (subj || "").toLowerCase();
  if (s.includes("english") || s.includes("literature")) return "CCSS.ELA-LITERACY";
  if (s.includes("algebra") || s.includes("geometry") || s.includes("calculus") || s.includes("math")) return "CCSS.MATH";
  if (s.includes("biology") || s.includes("chemistry") || s.includes("physics") || s.includes("marine")) return "NGSS HS-SCI";
  if (s.includes("history") || s.includes("government") || s.includes("economics")) return "C3.SOC-STUDIES";
  if (s.includes("mandarin") || s.includes("spanish") || s.includes("french") || s.includes("hindi")) return "ACTFL WORLD-LANG";
  return "U.S. COLLEGE-PREP";
}

function buildDiplomaCardHtml(stu, fam) {
  const globeSeal = buildGoldGlobeSealSvg();
  const gradYr = (stu && (stu.expected_grad_year || stu.grad_year)) || "2028";
  const famName = (fam && fam.family_name) || "GlobalPrep High";
  const stuName = (stu && stu.full_name) || "Student";
  return '<div id="printableDiplomaBox" style="font-family: Georgia, \'Times New Roman\', serif; color:#0f172a; background:#fffdf9; border:6px double #1e293b; padding:24px; margin-top:16px; text-align:center; box-sizing:border-box; max-width:100%; overflow:hidden;">' +
    '<div style="border:1px solid #94a3b8; padding:22px 16px;">' +
      '<div style="margin-bottom:10px;">' + globeSeal + '</div>' +
      '<div style="font-size:11px; letter-spacing:2px; text-transform:uppercase; color:#475569; margin-bottom:6px;">In Recognition of Academic Excellence</div>' +
      '<div style="font-size:22px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#0f172a;">' + famName + '</div>' +
      '<div style="width:120px; height:2px; background:#b45309; margin:12px auto;"></div>' +
      '<p style="font-size:15px; font-style:italic; color:#334155; margin:10px 0;">This certifies that</p>' +
      '<div style="font-size:26px; font-weight:700; letter-spacing:1px; color:#0f172a; margin:8px 0 12px 0;">' + stuName + '</div>' +
      '<p style="font-size:14px; line-height:1.65; max-width:540px; margin:0 auto; color:#1e293b;">has satisfactorily completed the prescribed Course of Study for Secondary Graduation in accordance with U.S. College-Preparatory Standards and is hereby awarded this</p>' +
      '<div style="font-size:20px; font-weight:700; letter-spacing:2.5px; text-transform:uppercase; color:#1e293b; margin:16px 0 6px 0;">High School Diploma</div>' +
      '<div style="font-size:14px; letter-spacing:1px; color:#334155;">Class of ' + gradYr + '</div>' +
      '<div style="display:flex; justify-content:space-around; align-items:flex-end; margin-top:34px; gap:20px; flex-wrap:wrap;">' +
        '<div style="font-size:12px;">_________________________<br><span style="font-size:10.5px; text-transform:uppercase; letter-spacing:0.8px; color:#334155;">Home-Education Administrator</span></div>' +
        '<div style="font-size:12px;">_________________________<br><span style="font-size:10.5px; text-transform:uppercase; letter-spacing:0.8px; color:#334155;">Date Conferred</span></div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function printDiplomaOnly() {
  const box = document.getElementById("printableDiplomaBox");
  if (!box) return window.print();
  const w = window.open("", "_blank");
  if (!w) return window.print();
  w.document.write('<!DOCTYPE html><html><head><title>High School Diploma</title><style>@page{size:landscape;margin:0.4in;}body{margin:0;padding:16px;background:#fff;}</style></head><body>' + box.outerHTML + '</body></html>');
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 300);
}

function renderOfficialRecords() {
  const stuId = document.getElementById("transStudentSelect").value;
  const stu = studentsCache.find(s => s.id === stuId);
  const preview = document.getElementById("officialDocsPreview");
  if (!stu) {
    preview.innerHTML = "<p class='muted'>Add a student first to generate their Transcript & Diploma.</p>";
    return;
  }
    const stuAchs = achievementsCache.filter(a => a.student_id === stu.id);
  const stuAssigns = assignmentsCache.filter(a => !a.student_id || String(a.student_id) === String(stu.id));
  const todayStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const courseMap = {};
  stuAssigns.forEach(a => {
    const key = a.quarter + "||" + a.subject + "||" + a.course_level;
    if (!courseMap[key]) {
      courseMap[key] = {
        quarter: a.quarter,
        subject: a.subject,
        course_level: a.course_level,
        credits: parseFloat(a.credits) || 1.0,
        scores: []
      };
    }
    const sub = submissionsCache.find(s => String(s.assignment_id) === String(a.id));
    const pct = sub && sub.grade ? parseGradePercent(sub.grade) : null;
    if (pct !== null) courseMap[key].scores.push(pct);
  });

  let totalCredits = 0;
  let weightedPoints = 0;
  let unweightedPoints = 0;

  const courseRank = (sub) => {
    const s = (sub || "").toLowerCase();
    if (s.includes("english") || s.includes("literature") || s.includes("algebra") || s.includes("geometry") || s.includes("calculus") || s.includes("biology") || s.includes("marine") || s.includes("chemistry") || s.includes("physics") || s.includes("history")) return 1;
    if (s.includes("mandarin") || s.includes("chinese") || s.includes("hindi") || s.includes("spanish") || s.includes("french")) return 2;
    return 3;
  };
  const sortedCourses = Object.values(courseMap).sort((a, b) => courseRank(a.subject) - courseRank(b.subject));
  const rows = sortedCourses.map(c => {
    let gradeDisplay = "In Progress";
    let crEarned = "0.00 (In Progress)";
    if (c.scores.length > 0) {
      const avgPct = c.scores.reduce((sum, v) => sum + v, 0) / c.scores.length;
      const { letter, pts } = percentToLetterAndPoints(avgPct);
      const boost = c.course_level.includes("AP") ? 1.0 : c.course_level.includes("Honors") ? 0.5 : 0;
      totalCredits += c.credits;
      unweightedPoints += pts * c.credits;
      weightedPoints += (pts + boost) * c.credits;
      gradeDisplay = "In Progress — " + avgPct.toFixed(0) + "% (" + letter + ")";
      crEarned = c.scores.length >= 45 ? c.credits.toFixed(2) : "0.00 (In Progress)";
    }
    const safeSub = (c.subject || "").replace(/'/g, "\\'");
    const safeLvl = (c.course_level || "Honors").replace(/'/g, "\\'");
    const stdTag = "";
    const actionBtns = '<span class="no-print" style="margin-left:6px; display:inline-flex; gap:4px;"><button type="button" class="btn-outline" style="width:auto; padding:2px 6px; font-size:11px; color:#1e293b;" onclick="editCourseRow(\'' + safeSub + '\',\'' + safeLvl + '\')">Edit</button><button type="button" class="btn-outline" style="width:auto; padding:2px 6px; font-size:11px; color:#b91c1c;" onclick="deleteCourseRow(\'' + safeSub + '\')">Delete</button></span>';
    return '<tr><td style="padding:8px 10px; border-bottom:1px solid #cbd5e1;">' + c.quarter + '</td><td style="padding:8px 10px; border-bottom:1px solid #cbd5e1;"><strong>' + c.subject + '</strong>' + actionBtns + '</td><td style="padding:8px 10px; border-bottom:1px solid #cbd5e1;">' + c.course_level + '</td><td style="padding:8px 10px; border-bottom:1px solid #cbd5e1;"><strong>' + gradeDisplay + '</strong></td><td style="padding:8px 10px; border-bottom:1px solid #cbd5e1;">' + c.credits.toFixed(2) + '</td><td style="padding:8px 10px; border-bottom:1px solid #cbd5e1;">' + crEarned + '</td></tr>';
  }).join("");
  const weightedGpa = totalCredits > 0 ? (weightedPoints / totalCredits).toFixed(2) : "N/A";
  const unweightedGpa = totalCredits > 0 ? (unweightedPoints / totalCredits).toFixed(2) : "N/A";
  const globeSeal = buildGoldGlobeSealSvg();

    const achSection = stuAchs.length
    ? '<div style="margin-top:18px; border-top:1px solid #94a3b8; padding-top:12px;"><div style="font-size:12px; font-weight:700; letter-spacing:0.8px; text-transform:uppercase; color:#1e293b; margin-bottom:6px;">Verified Certifications, Expeditions &amp; Honors</div>' + stuAchs.map(a => '<div style="font-size:12.5px; margin-bottom:4px;">• <strong>' + a.title + '</strong>' + (a.metric ? ' (' + a.metric + ')' : '') + (a.notes ? ' — ' + a.notes : '') + '</div>').join("") + '</div>'
    : "";

  const legalNotice = '<div style="margin-top:14px; padding:8px 10px; background:#f8fafc; border:1px solid #cbd5e1; font-size:10px; color:#475569; line-height:1.5;"><strong>Home-Education Legal &amp; Curriculum Disclosure:</strong> GlobalPrep High is a homeschool curriculum, gradebook, and academic recordkeeping platform and is not an accredited brick-and-mortar school. This transcript is issued directly by the Parent/Guardian Home-Education Administrator pursuant to applicable state homeschool laws. Curriculum benchmarks align with U.S. CCSS, NGSS, and C3 college-preparatory standards. Open educational reference streams provided via YouTube EDU, OpenStax (CC BY 4.0), PhET, Desmos, and Khan Academy.</div>';

  const transcriptHtml =
    '<div style="font-family: Georgia, \'Times New Roman\', serif; color:#0f172a; background:#ffffff; border:2px solid #0f172a; padding:32px; box-shadow:0 4px 16px rgba(15,23,42,0.08); margin-bottom:28px;">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px double #0f172a; padding-bottom:14px; margin-bottom:18px; gap:12px;">' +
        '<div style="display:flex; align-items:center; gap:14px;">' + globeSeal +
          '<div><div style="font-size:21px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase;">' + currentFamily.family_name + '</div>' +
          '<div style="font-size:11px; letter-spacing:1px; text-transform:uppercase; color:#334155; margin-top:2px;">Official High School Academic Transcript</div></div>' +
        '</div>' +
        '<div style="border:1.5px solid #0f172a; padding:6px 12px; text-align:center; font-size:11px; letter-spacing:0.8px; text-transform:uppercase;"><strong>Official Record</strong><br>Issued: ' + todayStr + '</div>' +
      '</div>' +
      '<table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:18px; background:#f8fafc; border:1px solid #cbd5e1;">' +
        '<tr><td style="padding:8px 12px; border-right:1px solid #cbd5e1;"><strong>Student Legal Name:</strong> ' + stu.full_name + '</td>' +
        '<td style="padding:8px 12px; border-right:1px solid #cbd5e1;"><strong>Grade Level:</strong> ' + stu.grade_level + '</td>' +
        '<td style="padding:8px 12px;"><strong>Expected Graduation:</strong> Class of ' + stu.expected_grad_year + '</td></tr>' +
        '<tr style="border-top:1px solid #cbd5e1;"><td style="padding:8px 12px; border-right:1px solid #cbd5e1;"><strong>Weighted Cumulative GPA:</strong> ' + weightedGpa + '</td>' +
        '<td style="padding:8px 12px; border-right:1px solid #cbd5e1;"><strong>Unweighted GPA:</strong> ' + unweightedGpa + '</td>' +
        '<td style="padding:8px 12px;"><strong>Total Credits Earned:</strong> ' + totalCredits.toFixed(2) + '</td></tr>' +
      '</table>' +
      '<table style="width:100%; border-collapse:collapse; font-size:13px; border:1px solid #94a3b8;">' +
        '<thead><tr style="background:#1e293b; color:#ffffff; text-transform:uppercase; font-size:11px; letter-spacing:0.8px;">' +
          '<th style="padding:9px 10px; text-align:left;">Term</th><th style="padding:9px 10px; text-align:left;">Course Title &amp; Standard</th><th style="padding:9px 10px; text-align:left;">Course Level</th><th style="padding:9px 10px; text-align:center;">Attempted</th><th style="padding:9px 10px; text-align:center;">Earned</th><th style="padding:9px 10px; text-align:center;">Final Grade</th>' +
        '</tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="6" style="padding:14px; text-align:center; color:#64748b;">No coursework recorded yet.</td></tr>') + '</tbody>' +
      '</table>' +
      achSection +
      '<div style="margin-top:14px; padding:8px 12px; background:#f8fafc; border:1px solid #cbd5e1; font-size:11px; color:#334155;"><strong>Grading &amp; Weighting Scale:</strong> A (90–100) = 4.0 &bull; B (80–89) = 3.0 &bull; C (70–79) = 2.0 &bull; D (60–69) = 1.0 &bull; Honors (+0.50) &bull; AP (+1.00)</div>' +
      legalNotice +
      '<div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:28px; font-size:13px;">' +
        '<div>____________________________________<br><span style="font-size:11px; text-transform:uppercase; letter-spacing:0.8px; color:#334155;">Parent / Home-Education Administrator Signature</span></div>' +
        '<div>________________________<br><span style="font-size:11px; text-transform:uppercase; letter-spacing:0.8px; color:#334155;">Date Certified</span></div>' +
      '</div>' +
    '</div>';

     const diplomaHtml =
    '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-top:22px; padding-top:14px; border-top:2px solid #cbd5e1;">' +
      '<strong style="font-size:16px; color:#0f172a;">🎓 Official High School Diploma Preview</strong>' +
      '<button type="button" class="btn-primary no-print" style="width:auto; padding:8px 14px;" onclick="printDiplomaOnly()">🖨️ Print / Save Diploma PDF</button>' +
    '</div>' +
    buildDiplomaCardHtml(stu, currentFamily);

  preview.innerHTML = transcriptHtml + diplomaHtml;
}


function getYouTubeEmbed(url) {
  const base = "https://youtube.com";
  if (!url) return null;
  if (url.startsWith("yt:")) return base + url.slice(3).trim();
  const m = url.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  return m ? base + m.at(1) : null;
}

function switchStudentTab(tabName, btn) {
  document.querySelectorAll(".stu-tab-btn").forEach(b => {
    b.classList.remove("active");
    b.style.background = "#ffffff";
    b.style.color = "#0f172a";
    b.style.borderColor = "#cbd5e1";
  });
  if (btn) {
    btn.classList.add("active");
    btn.style.background = "#1e3a8a";
    btn.style.color = "#ffffff";
    btn.style.borderColor = "#1e3a8a";
  }
  document.querySelectorAll(".s-view").forEach(v => v.classList.add("hidden"));
  const target = document.getElementById("sView-" + tabName);
  if (target) target.classList.remove("hidden");
}

function getSubjectMediaPack(subject) {
  const s = (subject || "").toLowerCase();
  const YT = "https://youtube.com";
  if (s.includes("english") || s.includes("literature")) {
    return { yt: YT + "erkLXTvTrp8", label: "Ray Bradbury & Dystopian Literature Video" };
  }
  if (s.includes("algebra")) {
    return { yt: YT + "NybHckSEQBI", label: "Algebra Linear Equations Video" };
  }
  if (s.includes("geometry")) {
    return { yt: YT + "302eJ3TzJQU", label: "Geometry Proofs & Parallel Lines Video" };
  }
  if (s.includes("calculus") || s.includes("math")) {
    return { yt: YT + "WUvTyaaNkzM", label: "Mathematics Visual Essence Video" };
  }
  if (s.includes("marine")) {
    return { yt: YT + "3GRA70KOSPg", label: "Marine Biology & Ocean Ecosystems Video" };
  }
  if (s.includes("biology")) {
    return { yt: YT + "eJ9Zjc-jdys", label: "Amoeba Sisters: Cellular Respiration Video" };
  }
  if (s.includes("chemistry")) {
    return { yt: YT + "FSyAehMdpyI", label: "CrashCourse Chemistry: Atomic Structure Video" };
  }
  if (s.includes("physics") || s.includes("science")) {
    return { yt: YT + "ZM8ECpBuQYE", label: "Physics Motion & Forces Video" };
  }
  if (s.includes("history") || s.includes("government") || s.includes("economics")) {
    return { yt: YT + "Yocja_N5s1I", label: "CrashCourse World History: Mesopotamia & Hammurabi" };
  }
  if (s.includes("mandarin") || s.includes("chinese")) {
    return { yt: YT + "McZW0iOgSrv", label: "Mandarin Chinese 4-Tone Pronunciation Video" };
  }
  if (s.includes("hindi")) {
    return { yt: YT + "1lrz11BbqCA", label: "Hindi Devanagari Pronunciation Video" };
  }
  if (s.includes("spanish")) {
    return { yt: YT + "DAp_v7EH9AA", label: "Spanish Conversational Foundations Video" };
  }
  if (s.includes("french")) {
    return { yt: YT + "ujDtm0hZyII", label: "French Pronunciation & Greetings Video" };
  }
  if (s.includes("automotive") || s.includes("mechanics")) {
    return { yt: YT + "ZQvfHyfgBtA", label: "How a 4-Stroke Engine Works Video" };
  }
  if (s.includes("stock") || s.includes("financial") || s.includes("entrepreneurship")) {
    return { yt: YT + "p7HKvqRI_Bo", label: "How the Stock Market & Equities Work Video" };
  }
  return { yt: YT + "8jPQjjsBbIc", label: "Honors Study Strategy Video" };
}

function formatLessonSteps(rawDesc, subject) {
  let text = (rawDesc || "").trim();
  const s = (subject || "").toLowerCase();
  if (s.includes("history") && !text.toLowerCase().includes("louvre")) {
    text = "🏛️ HISTORICAL CONTEXT — THE LOUVRE: Originally built in 1190 as a medieval fortress by King Philip II and later transformed into the French royal palace before opening as a public museum during the French Revolution in 1793, the Louvre houses over 35,000 works spanning ancient Mesopotamia, Egypt, Greece, and the Renaissance.\n\n" + text;
  }
  if (s.includes("biology") && text.toLowerCase().includes("yeast")) {
    text += "\n\n🥄 NO-YEAST HOUSEHOLD ALTERNATIVE: If you do not have active dry yeast on hand, mix 2 tablespoons of baking soda with 1/2 cup of warm vinegar (or lemon juice) inside a clear bottle with a balloon stretched over the top to observe rapid CO2 gas expansion, then compare chemical acid-base gas release with biological cellular respiration!";
  }
  if (s.includes("algebra") || s.includes("geometry") || s.includes("calculus") || s.includes("math")) {
    text += "\n\n✏️ REQUIRED PAPER WORK: Grab a sheet of lined or graph paper, copy each problem neatly, show every algebraic step line-by-line, box your final answer, and snap a photo below so your parent can review your process!";
  }
  let formatted = text
    .replace(/\s+(?=\d+\.\s)/g, "<br><br>")
    .replace(/\n\n+/g, "<br><br>")
    .replace(/\n/g, "<br>")
    .replace(/\b([A-Z][A-Z0-9\s,&'’—-]{3,}:)/g, "<strong>$1</strong>");
  return formatted;
}

function checkInlineQuiz(assignId, qIdx, chosenIdx, correctIdx) {
  const fb = document.getElementById("qz-fb-" + assignId + "-" + qIdx);
  if (!fb) return;
  if (Number(chosenIdx) === Number(correctIdx)) {
    fb.style.color = "#15803d";
    fb.innerText = "✅ Correct! Great job.";
  } else {
    fb.style.color = "#b91c1c";
    fb.innerText = "❌ Not quite—re-check the video/notes above and try again!";
  }
}

function speakPronunciation(phrase, langCode) {
  if (!("speechSynthesis" in window)) {
    return alert("Phonetic Pronunciation: " + phrase);
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(phrase);
  utter.lang = langCode || "en-US";
  utter.rate = 0.85;
  window.speechSynthesis.speak(utter);
}

function toggleLessonStep(assignId, stepIdx, totalSteps, isChecked) {
  const key = "gph_steps_" + assignId;
  const saved = JSON.parse(localStorage.getItem(key) || "{}");
  saved[stepIdx] = !!isChecked;
  localStorage.setItem(key, JSON.stringify(saved));
  let done = 0;
  for (let i = 0; i < totalSteps; i++) {
    if (saved[i]) done++;
  }
  const pct = Math.round((done / totalSteps) * 100);
  const el = document.getElementById("pct-" + assignId);
  if (el) el.innerText = pct + "% Complete";
}

function buildPronunciationBar(subject) {
  const s = (subject || "").toLowerCase();
  if (s.includes("history")) {
    return '<div style="background:#f0f9ff; border:1px solid #bae6fd; padding:8px 12px; border-radius:8px; margin:8px 0; display:flex; flex-wrap:wrap; align-items:center; gap:8px; font-size:13px;"><span>🗣️ <b>Key Pronunciations:</b></span><button type="button" class="btn-outline" style="width:auto; color:#0369a1; padding:4px 10px; font-size:12px;" onclick="speakPronunciation(\'Hammurabi\', \'en-US\')">🔊 Hammurabi (hah-moo-RAH-bee)</button><button type="button" class="btn-outline" style="width:auto; color:#0369a1; padding:4px 10px; font-size:12px;" onclick="speakPronunciation(\'Louvre\', \'fr-FR\')">🔊 Louvre (LOOV-ruh)</button><button type="button" class="btn-outline" style="width:auto; color:#0369a1; padding:4px 10px; font-size:12px;" onclick="speakPronunciation(\'Mesopotamia\', \'en-US\')">🔊 Mesopotamia (mes-uh-puh-TAY-mee-uh)</button></div>';
  }
  if (s.includes("mandarin") || s.includes("chinese")) {
    return '<div style="background:#f0f9ff; border:1px solid #bae6fd; padding:8px 12px; border-radius:8px; margin:8px 0; display:flex; flex-wrap:wrap; align-items:center; gap:8px; font-size:13px;"><span>🗣️ <b>Tap to Hear Mandarin Pronunciation:</b></span><button type="button" class="btn-outline" style="width:auto; color:#0369a1; padding:4px 10px; font-size:12px;" onclick="speakPronunciation(\'你好\', \'zh-CN\')">🔊 Nǐ hǎo (nee HOW • Hello)</button><button type="button" class="btn-outline" style="width:auto; color:#0369a1; padding:4px 10px; font-size:12px;" onclick="speakPronunciation(\'谢谢\', \'zh-CN\')">🔊 Xièxie (SHYEH-shyeh • Thank you)</button><button type="button" class="btn-outline" style="width:auto; color:#0369a1; padding:4px 10px; font-size:12px;" onclick="speakPronunciation(\'再见\', \'zh-CN\')">🔊 Zàijiàn (DZAI-jyen • Goodbye)</button></div>';
  }
  if (s.includes("spanish")) {
    return '<div style="background:#f0f9ff; border:1px solid #bae6fd; padding:8px 12px; border-radius:8px; margin:8px 0; display:flex; flex-wrap:wrap; align-items:center; gap:8px; font-size:13px;"><span>🗣️ <b>Tap to Hear Spanish Pronunciation:</b></span><button type="button" class="btn-outline" style="width:auto; color:#0369a1; padding:4px 10px; font-size:12px;" onclick="speakPronunciation(\'Buenos días, ¿cómo estás?\', \'es-ES\')">🔊 Buenos días, ¿cómo estás?</button><button type="button" class="btn-outline" style="width:auto; color:#0369a1; padding:4px 10px; font-size:12px;" onclick="speakPronunciation(\'Muchas gracias\', \'es-ES\')">🔊 Muchas gracias</button></div>';
  }
  if (s.includes("french")) {
    return '<div style="background:#f0f9ff; border:1px solid #bae6fd; padding:8px 12px; border-radius:8px; margin:8px 0; display:flex; flex-wrap:wrap; align-items:center; gap:8px; font-size:13px;"><span>🗣️ <b>Tap to Hear French Pronunciation:</b></span><button type="button" class="btn-outline" style="width:auto; color:#0369a1; padding:4px 10px; font-size:12px;" onclick="speakPronunciation(\'Bonjour, comment allez-vous ?\', \'fr-FR\')">🔊 Bonjour, comment allez-vous ?</button><button type="button" class="btn-outline" style="width:auto; color:#0369a1; padding:4px 10px; font-size:12px;" onclick="speakPronunciation(\'Merci beaucoup\', \'fr-FR\')">🔊 Merci beaucoup</button></div>';
  }
  return "";
}
function splitLessonParts(rawDesc, subject) {
  const s = (subject || "").toLowerCase();
  let intro = "";
  if (s.includes("history")) {
    intro = "<strong>STEP 1 — HISTORICAL BACKGROUND (THE LOUVRE &amp; BABYLON):</strong><br>Originally built in 1190 as a medieval fortress by King Philip II and later transformed into the French royal palace before opening as a public museum in 1793, the <b>Louvre</b> houses over 35,000 works—including the 7.4-foot basalt steel of King <b>Hammurabi</b> (c. 1754 BCE). Watch the video below first to explore how early written law shaped civilization.";
  } else if (s.includes("biology") || s.includes("chemistry") || s.includes("science")) {
    intro = "<strong>STEP 1 — CONCEPT &amp; LAB BRIEFING:</strong><br>Watch the video below first to observe how molecules and energy transform during chemical and biological reactions, then complete the hands-on lab steps underneath.";
  } else if (s.includes("algebra") || s.includes("geometry") || s.includes("calculus") || s.includes("math")) {
    intro = "<strong>STEP 1 — CONCEPT BRIEFING &amp; TOOLKIT:</strong><br>Watch the step-by-step video lesson below first. Use the <b>Calculator &amp; Line Grapher</b> button right below to verify graphs, and write out every algebraic step neatly on paper!";
  } else if (s.includes("mandarin") || s.includes("spanish") || s.includes("french") || s.includes("hindi")) {
    intro = "<strong>STEP 1 — LISTENING &amp; PRONUNCIATION WARM-UP:</strong><br>Tap the speaker buttons above to hear native pronunciation, then watch the video below to practice rhythm, tones, and conversational phrases.";
  } else {
    intro = "<strong>STEP 1 — LESSON OVERVIEW:</strong><br>Watch the video below first to master today's core concept before completing the step-by-step activity underneath.";
  }

  let body = (rawDesc || "").trim();
  if (s.includes("biology") && body.toLowerCase().includes("yeast")) {
    body += "\n\n🥄 NO-YEAST HOUSEHOLD ALTERNATIVE: If you do not have active dry yeast on hand, mix 2 tablespoons of baking soda with 1/2 cup of warm vinegar (or lemon juice) inside a clear bottle with a balloon stretched over the top to observe rapid CO2 gas expansion, then compare chemical acid-base gas release with biological cellular respiration!";
  }
  if (s.includes("algebra") || s.includes("geometry") || s.includes("calculus") || s.includes("math")) {
    body += "\n\n✏️ REQUIRED PAPER WORK: Grab a sheet of lined or graph paper, copy each problem neatly, show every step line-by-line, box your final answer, and upload a photo below!";
  }

  const formattedBody = "<strong>STEP 2 — STEP-BY-STEP INSTRUCTIONS &amp; ACTIVITY:</strong><br>" + body
    .replace(/\s+(?=\d+\.\s)/g, "<br><br>")
    .replace(/\n\n+/g, "<br><br>")
    .replace(/\n/g, "<br>")
    .replace(/\b([A-Z][A-Z0-9\s,&'’—-]{3,}:)/g, "<strong>$1</strong>");

  return { intro, formattedBody };
}

window.stuCourseOpen = false;
window.stuViewDayOffset = {};
window.stuAllBySubject = {};
window.stuGridPoints = {};

function openStudentCourse(idx) {
  selectedStuSubjectIdx = idx;
  window.stuCourseOpen = true;
  renderStudentTodayPane();
}

function closeStudentCourseMenu() {
  window.stuCourseOpen = false;
  renderStudentTodayPane();
}

function shiftStudentDay(subj, delta, maxLen) {
  const cur = typeof window.stuViewDayOffset.subj === "number" ? window.stuViewDayOffset.subj : (maxLen - 1);
  window.stuViewDayOffset.subj = Math.max(0, Math.min(maxLen - 1, cur + delta));
  renderStudentTodayPane();
}

function speakWordInline(word, langCode) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.lang = langCode || "en-US";
  u.rate = 0.88;
  window.speechSynthesis.speak(u);
}

function checkInstantQC(assignId, qIdx, optIdx, correctIdx, whyRight, whyWrong) {
  const box = document.getElementById("qc_fb_" + assignId + "_" + qIdx);
  if (!box) return;
  if (optIdx === correctIdx) {
    box.style.background = "#dcfce7";
    box.style.color = "#15803d";
    box.innerHTML = "✅ <b>Correct!</b> " + whyRight;
  } else {
    box.style.background = "#fee2e2";
    box.style.color = "#b91c1c";
    box.innerHTML = "❌ <b>Not quite — try again!</b> " + whyWrong;
  }
}
function injectInlinePronunciations(html, subject) {
  const s = (subject || "").toLowerCase();
  const terms = s.includes("spanish")
    ? [
        { w: "Buenos días", p: "BWEH-nohs DEE-ahs", l: "es-ES" },
        { w: "Por favor", p: "por fah-VOR", l: "es-ES" },
        { w: "Muchas gracias", p: "MOO-chahs GRAH-syahs", l: "es-ES" },
        { w: "Quisiera", p: "kee-SYEH-rah", l: "es-ES" },
        { w: "La cuenta", p: "lah KWEN-tah", l: "es-ES" }
      ]
    : s.includes("history")
      ? [
          { w: "Hammurabi", p: "hah-moo-RAH-bee", l: "en-US" },
          { w: "Cuneiform", p: "kyoo-NEE-uh-form", l: "en-US" },
          { w: "Mesopotamia", p: "mes-uh-puh-TAY-mee-uh", l: "en-US" },
          { w: "Lex Talionis", p: "leks tah-lee-OH-nis", l: "en-US" }
        ]
      : s.includes("marine")
        ? [
            { w: "Thermohaline", p: "thur-moh-HAY-leen", l: "en-US" },
            { w: "Zooxanthellae", p: "zoh-uh-zan-THEL-ee", l: "en-US" },
            { w: "Salinity", p: "suh-LIN-ih-tee", l: "en-US" }
          ]
        : s.includes("biology")
          ? [
              { w: "Saccharomyces", p: "sak-uh-roh-MY-seez", l: "en-US" },
              { w: "Hypothesis", p: "hy-POTH-uh-sis", l: "en-US" },
              { w: "Metabolism", p: "muh-TAB-uh-liz-um", l: "en-US" }
            ]
          : (s.includes("literature") || s.includes("english"))
            ? [
                { w: "Dystopia", p: "dis-TOH-pee-uh", l: "en-US" },
                { w: "Censorship", p: "SEN-ser-ship", l: "en-US" },
                { w: "Foreshadowing", p: "for-SHAD-oh-ing", l: "en-US" }
              ]
            : [];
  let out = html;
  terms.forEach(t => {
    const safeW = t.w.replace(/'/g, "\\'");
    const pill = `<span onclick="speakWordInline('${safeW}','${t.l}')" style="background:#e0f2fe; color:#0369a1; border-bottom:2px dotted #0284c7; padding:1px 5px; border-radius:4px; cursor:pointer; font-weight:700;">🔊 ${t.w} <small>(${t.p})</small></span>`;
    out = out.replace(new RegExp("\\b" + t.w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i"), pill);
  });
  return out;
}
function getKhanLessonContent(subject, dayNum, baseDesc) {
  const s = (subject || "").toLowerCase();

  if (s.includes("history")) {
    if (dayNum === 1) {
      return {
        unitTitle: "UNIT 1 • CHAPTER 1.1: Historical Thinking, Primary Sources & The Code of Hammurabi (c. 1750 BCE)",
        objectives: [
          "Distinguish between primary and secondary historical sources.",
          "Apply the AP/Honors HIPP historical analysis framework.",
          "Evaluate what Hammurabi's Code reveals about social hierarchy and justice."
        ],
        hook: "In 1901, archaeologists excavating Susa uncovered a 7-foot black basalt stele carved in wedge-shaped Cuneiform script. At the top, Shamash—the Mesopotamian god of justice—hands royal authority directly to Babylonian King Hammurabi.",
        yt: "xVf5kZA0HtQ",
        ytLabel: "Watch: Ancient Mesopotamia 101 | National Geographic",
        textbookHtml: `<h4 style="color:#9a3412; margin:0 0 6px 0;">1. Thinking Like a Historian &amp; The HIPP Method</h4><p>Scholars divide evidence into <b>Primary Sources</b> (firsthand artifacts created during the era—law tablets, letters, treaties) and <b>Secondary Sources</b> (interpretations written later). Honors historians interrogate every primary source using <b>HIPP</b>:</p><div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(135px,1fr)); gap:8px; margin:8px 0;"><div style="background:#9a3412; color:#fff; padding:8px; border-radius:6px;"><b>H — Historical Context</b><br><small>c. 1750 BCE Babylon unifying city-states</small></div><div style="background:#b45309; color:#fff; padding:8px; border-radius:6px;"><b>I — Intended Audience</b><br><small>Subjects, judges &amp; future kings</small></div><div style="background:#c2410c; color:#fff; padding:8px; border-radius:6px;"><b>P — Purpose</b><br><small>Standardize justice &amp; assert authority</small></div><div style="background:#7c2d12; color:#fff; padding:8px; border-radius:6px;"><b>P — Point of View</b><br><small>Absolute monarch claiming divine backing</small></div></div><h4 style="color:#9a3412; margin:10px 0 6px 0;">2. Mesopotamia &amp; Primary Source Laws (Lex Talionis)</h4><p>Located between the Tigris and Euphrates rivers in modern-day Iraq, Mesopotamia developed cuneiform literacy, base-60 time, and Hammurabi's 282 laws. While introducing <b>Lex Talionis</b> ("an eye for an eye"), punishments depended strictly on class (Awilum nobles, Mushkenum commoners, Wardum enslaved):</p><div style="background:#fff; border-left:4px solid #b45309; padding:8px 12px; border-radius:6px; margin:8px 0; font-size:13.5px;">• <b>Law 196:</b> "If a man put out the eye of another man [a noble], his eye shall be put out."<br>• <b>Law 198:</b> "If he put out the eye of a freed commoner, he shall pay one gold mina."<br>• <b>Law 199:</b> "If he put out the eye of a man's slave, he shall pay one-half of its value."<br>• <b>Law 229:</b> "If a builder builds a house for someone and does not construct it properly, and the house collapses and kills its owner, that builder shall be put to death."</div>`,
        qc: [
          { q: "Which item is a PRIMARY historical source?", opts: ["A 2026 history textbook", "The 1750 BCE basalt stele of Hammurabi", "A modern documentary"], a: 1, r: "Primary sources were created directly during the era studied.", w: "Look for an artifact created in 1750 BCE." },
          { q: "In HIPP, what does the 'I' stand for?", opts: ["Imperial Army", "Intended Audience", "Industrial Trade"], a: 1, r: "HIPP = Historical Context, Intended Audience, Purpose, Point of View.", w: "Check the 4 orange HIPP boxes above." },
          { q: "Under Laws 196–199, what happened if a noble injured a freed commoner's eye?", opts: ["The noble lost his own eye", "The noble paid one gold mina fine", "No penalty existed"], a: 1, r: "Law 198 required a fine of one gold mina.", w: "Re-read Law 198 above." }
        ],
        prompts: [
          "1. Royal Judge Roleplay: A wealthy noble injures the eye of a freed artisan, while across town a negligent builder's roof collapses and kills a homeowner. Using Laws 196–229, what exact sentences must you hand down?",
          "2. Social Hierarchy & Corroboration (6–8 sentences): Hammurabi claimed his laws existed 'so that the strong should not harm the weak.' Based on Laws 196–199, to what extent did his laws live up to that claim?",
          "3. 🌍 Global Explorer Bonus (+5 Extra Credit Points): Hammurabi's stele originally stood in Babylon (Iraq), but today is housed in which world-famous glass-pyramid museum in Paris?"
        ]
      };
    }
    return {
      unitTitle: `UNIT 1 • LESSON 1.${dayNum}: Ancient River Valleys, Trade Networks & Primary Evidence`,
      objectives: ["Compare governance in Ancient Egypt and the Indus Valley.", "Analyze how geography shaped early trade and writing systems."],
      hook: "While Mesopotamia built mud-brick ziggurats along unpredictable rivers, Egypt's predictable Nile floods fostered a unified kingdom lasting 3,000 years.",
      yt: "Z3Wvw6BivVI",
      ytLabel: "Watch: Ancient Egypt | Crash Course World History",
      textbookHtml: `<h4 style="color:#9a3412; margin:0 0 6px 0;">1. Comparing Nile &amp; Indus River Civilizations</h4><p>Unlike Mesopotamia's warring city-states, Ancient Egypt unified early under Pharaohs viewed as divine rulers, developing hieroglyphic script and monumental stone architecture. Meanwhile, the Indus Valley cities of Harappa and Mohenjo-Daro engineered grid-planned streets and indoor plumbing centuries before Rome.</p>`,
      qc: [
        { q: "How did Egypt's geography differ from Mesopotamia's?", opts: ["The Nile flooded predictably and deserts offered protection", "Egypt had no rivers", "Egypt was an island"], a: 0, r: "Predictable Nile floods and surrounding deserts gave Egypt stability.", w: "Re-read Section 1 above." },
        { q: "Which Indus Valley innovation was centuries ahead of its time?", opts: ["Steam locomotives", "Grid-planned cities and covered drainage", "Printing presses"], a: 1, r: "Harappa and Mohenjo-Daro featured grid streets and drainage.", w: "Check Section 1 above." },
        { q: "Why do historians corroborate royal monuments with merchant letters?", opts: ["To uncover everyday reality beyond royal propaganda", "Because monuments have no writing", "To ignore primary sources"], a: 0, r: "Comparing multiple perspectives removes single-author bias.", w: "Think about Point of View in HIPP." }
      ],
      prompts: [
        "1. Comparative Analysis (8–10 sentences): Compare how geography shaped government and daily life in Ancient Egypt versus Mesopotamia.",
        "2. 🌍 Global Explorer Bonus (+5 Extra Credit Points): Which Rosetta Stone city in northern Egypt gave its name to the slab that unlocked hieroglyphics?"
      ]
    };
  }
  if (s.includes("literature") || s.includes("english")) {
    const litMap = {
      1: {
        unitTitle: "UNIT 1 • CHAPTER 1.1: Fahrenheit 451 — Part 1: The Hearth and the Salamander (pp. 1–55)",
        objectives: [
          "Analyze how Ray Bradbury contrasts curiosity (Clarisse) with screen conformity (Mildred).",
          "Evaluate dystopian foreshadowing and fire imagery in pages 1–55."
        ],
        hook: "In 2026, algorithms curate what you watch every second. Written in 1953, Fahrenheit 451 asks what happens when a society willingly trades deep reading for wall-sized interactive screens.",
        yt: "YMZcp0EQO2s",
        ytLabel: "Watch: Why should you read 'Fahrenheit 451'? | TED-Ed",
        textbookHtml: `<h4 style="color:#1e3a8a; margin:0 0 6px 0;">1. Dystopia &amp; Bradbury's Core Warning</h4><p>Unlike Orwell's <i>1984</i> (where totalitarian force bans books), Bradbury's <b>Dystopia</b> shows citizens voluntarily abandoning books for fast cars, Seashell earbuds, and parlor-wall TV 'families.' Fireman Guy Montag assumes he is happy—until 17-year-old Clarisse McClellan asks him one simple question: <i>"Are you happy?"</i></p>`,
        qc: [
          { q: "What sparks Guy Montag's inner awakening in Part 1?", opts: ["A promotion from Captain Beatty", "Clarisse McClellan asking 'Are you happy?'", "Winning a parlor-wall contest"], a: 1, r: "Clarisse's simple question forces Montag to confront his emptiness.", w: "Check Section 1 above." },
          { q: "How did books disappear in Bradbury's society?", opts: ["People stopped reading on their own due to speed and entertainment", "An alien invasion", "Paper ran out"], a: 0, r: "Bradbury warned against self-censorship driven by distraction.", w: "Re-read Section 1 above." },
          { q: "What literary device hints early on at Montag's hidden stash of books?", opts: ["Foreshadowing", "Onomatopoeia", "Alliteration"], a: 0, r: "Montag's glances toward the ventilator grille foreshadow his secret.", w: "Think of clues hinting at future events." }
        ],
        prompts: [
          "1. Reading & Honors Analysis (8–12 sentences): Tap the Fahrenheit 451 PDF button below and read pages 1–55 (40 min lesson). Compare Clarisse's curiosity with Mildred's screen obsession, citing two specific moments from pages 1–55 and connecting them to 2026 media.",
          "2. 🌍 Global Explorer Bonus (+5 Extra Credit Points): Name one real-world city or country where Fahrenheit 451 faced censorship or removal and explain why!"
        ]
      },
      2: {
        unitTitle: "UNIT 1 • CHAPTER 1.2: Fahrenheit 451 — Part 2: The Sieve and the Sand (pp. 66–103)",
        objectives: [
          "Analyze Faber's three requirements for a thoughtful society.",
          "Examine how sensory overload (the subway jingle) prevents critical thinking."
        ],
        hook: "Have you ever tried studying while loud ads blare in your ears? Montag experiences that exact battle on the subway as Denham's Dentifrice jingles drown out his attempt to read.",
        yt: "7aKItfLeso4",
        ytLabel: "Watch: Ray Bradbury on Writing & Fahrenheit 451",
        textbookHtml: `<h4 style="color:#1e3a8a; margin:0 0 6px 0;">1. Faber's Three Pillars of Meaningful Culture</h4><p>In Part 2 (pp. 66–103), former English professor Faber explains to Montag that books themselves are not magic; what society lacks are three essentials: <b>(1) Quality of information</b>, <b>(2) Leisure to digest it</b>, and <b>(3) The right to carry out actions</b> based on what we learn. Meanwhile, Captain Beatty visits Montag and twists literary quotes to argue that conflicting ideas only make people unhappy.</p>`,
        qc: [
          { q: "Which is NOT one of Faber's three requirements?", opts: ["Quality of information", "Leisure to digest it", "Wall-sized parlor screens"], a: 2, r: "Faber lists quality, leisure, and the freedom to act on what we learn.", w: "Review Section 1 above." },
          { q: "What does the title 'The Sieve and the Sand' symbolize?", opts: ["Montag trying to retain reading while subway ads blast his mind", "A beach vacation", "Building a desert fortress"], a: 0, r: "Like sand pouring through a sieve, loud jingles wash away Montag's concentration.", w: "Think about Montag on the subway in Part 2." },
          { q: "How does Captain Beatty surprise Montag?", opts: ["Beatty has memorized vast amounts of literature himself", "Beatty cannot read", "Beatty resigns"], a: 0, r: "Beatty knows books intimately and twists quotes to justify burning them.", w: "Check Section 1 above." }
        ],
        prompts: [
          "1. Reading & Honors Analysis (8–12 sentences): Read Fahrenheit 451 Part 2 (pages 66–103). Explain Faber's three requirements and evaluate whether modern 2026 notifications create a 'sieve and the sand' effect.",
          "2. 🌍 Global Explorer Bonus (+5 Extra Credit Points): Where in the world did the ancient Library of Alexandria stand, and why is it famous in literary history?"
        ]
      }
    };
    return litMap[dayNum] || {
      unitTitle: `UNIT ${Math.ceil(dayNum / 10)} • LESSON 1.${dayNum}: ${dayNum <= 5 ? "Fahrenheit 451 Part 3 (pp. 104–158) & Dystopian Synthesis" : "Classical & Global Rhetoric, Short Fiction & Poetry"}`,
      objectives: ["Analyze authorial voice, symbolism, and rhetorical persuasion.", "Support literary claims with direct textual evidence."],
      hook: "From Bradbury's Book People memorizing classics to global short fiction and rhetoric, great literature preserves human memory across generations.",
      yt: "e-2Y-2-559k",
      ytLabel: "Watch: How to Use Rhetoric to Get What You Want | TED-Ed",
      textbookHtml: `<h4 style="color:#1e3a8a; margin:0 0 6px 0;">1. Symbolism, Rhetoric &amp; Literary Synthesis</h4><p>In Part 3 of <i>Fahrenheit 451</i> (pp. 104–158), fire shifts from a tool of destruction to a source of warmth at Granger's camp, while the Phoenix symbolizes humanity rebuilding from its ashes. In Weeks 3–9, we transition into Rhetoric (Ethos, Pathos, Logos), World Short Fiction (Chekhov, Borges, Achebe), and Global Poetry.</p>`,
      qc: [
        { q: "What does the Phoenix symbolize at the end of Fahrenheit 451?", opts: ["Humanity's ability to learn from its mistakes and rebuild", "Permanent extinction", "Mechanical Hounds"], a: 0, r: "Granger compares humanity to the mythical Phoenix rising from its ashes.", w: "Review Section 1 above." },
        { q: "Which rhetorical appeal relies on logic and evidence?", opts: ["Logos", "Pathos", "Hyperbole"], a: 0, r: "Logos appeals to reason, facts, and structured evidence.", w: "Think of 'logic' -> Logos." },
        { q: "Why do the Book People memorize whole books?", opts: ["To preserve human knowledge until society is ready to read again", "To sell them", "To win a game"], a: 0, r: "Each person becomes a living book to safeguard civilization.", w: "Check Section 1 above." }
      ],
      prompts: [
        "1. Honors Literary Synthesis (8–12 sentences): Complete today's reading (pp. 104–158 if finishing Fahrenheit 451 in Week 1–2, or analyze Ethos/Pathos/Logos in the passage above) with two specific textual examples.",
        "2. 🌍 Global Explorer Bonus (+5 Extra Credit Points): Which European capital hosts the Nobel Prize in Literature ceremony every December?"
      ]
    };
  }
    if (s.includes("marine")) {
    return {
      unitTitle: dayNum === 1 ? "UNIT 1 • CHAPTER 1.1: Foundations of Oceanography, Salinity & Reef Symbiosis" : `UNIT 1 • LESSON 1.${dayNum}: Pelagic Ocean Zones, Food Webs & Marine Adaptations`,
      objectives: ["Define ocean salinity (35 ppt) and thermohaline density currents.", "Analyze mutualistic symbiosis between corals and zooxanthellae algae."],
      hook: "Earth's oceans cover 71% of the planet and generate over half of the oxygen you breathe—yet we have mapped less of the deep ocean floor than the surface of Mars.",
      yt: dayNum === 1 ? "q65O3qA0-n4" : "f2Gv5M4fJ4Y",
      ytLabel: dayNum === 1 ? "Watch: How Ocean Currents Work | TED-Ed" : "Watch: Deep Ocean Zones & Ecosystems",
      textbookHtml: `<h4 style="color:#0369a1; margin:0 0 6px 0;">1. Ground-Zero Oceanography: Salinity (35 ppt) &amp; Reef Symbiosis</h4><p>Ocean water averages <b>35 parts per thousand (35 ppt, or 3.5%)</b> dissolved <b>Salinity</b>. Cold, salty water is denser and sinks, driving global <b>Thermohaline</b> circulation. In tropical reefs, corals share mutualistic symbiosis with photosynthetic algae called <b>Zooxanthellae</b>, which supply up to 90% of the coral's energy from sunlight.</p>`,
      qc: [
        { q: "What is the average salinity of Earth's oceans?", opts: ["35 parts per thousand (3.5%)", "0.5 ppt", "50% salt"], a: 0, r: "Average seawater is 35 ppt (35 g salt per 1,000 g water).", w: "Check Section 1 above." },
        { q: "Which water mass is densest and sinks to drive thermohaline currents?", opts: ["Cold, high-salinity water", "Warm freshwater", "Warm low-salinity water"], a: 0, r: "Cold temperature and higher salt concentration increase density.", w: "Re-read Section 1 above." },
        { q: "How do zooxanthellae algae help reef corals?", opts: ["They photosynthesize to provide up to 90% of the coral's energy", "They freeze seawater", "They eat sharks"], a: 0, r: "Zooxanthellae convert sunlight into energy for the coral.", w: "Check Section 1 above." }
      ],
      prompts: [
        "1. Hands-On Lab (Coastal or Inland At-Home Seawater Simulation): Near the coast? Measure local seawater clarity, temperature, and buoyancy. Inland? Mix 3 cups: (A) 35 ppt seawater (3.5 tsp sea salt in 500 mL water), (B) 15 ppt brackish (1.5 tsp salt), and (C) 0 ppt freshwater. Test how high a grape or raw egg floats in each cup and record your measurements!",
        "2. Honors Analysis (8–10 sentences): Explain how salinity affects buoyancy and ocean currents, and why warming water causes coral bleaching.",
        "3. 🌍 Global Explorer Bonus (+5 Extra Credit Points): Name the country home to the Great Barrier Reef—the largest coral reef system on Earth!"
      ]
    };
  }
  if (s.includes("biology")) {
    return {
      unitTitle: dayNum === 1 ? "UNIT 1 • CHAPTER 1.1: The Nature of Science & Experimental Design" : `UNIT 1 • LESSON 1.${dayNum}: Cell Membranes, Osmosis & Homeostasis`,
      objectives: dayNum === 1
        ? ["Distinguish qualitative vs. quantitative data and write 'If... then... because...' hypotheses.", "Identify Independent Variable (IV), Dependent Variable (DV), Control Group, and Constants."]
        : ["Explain how the phospholipid bilayer regulates transport.", "Predict water movement in hypotonic, isotonic, and hypertonic solutions."],
      hook: dayNum === 1
        ? "In 1928, Alexander Fleming noticed a bacteria-free halo around blue-green mold on a culture dish—turning one careful observation into penicillin, the first antibiotic."
        : "Your body contains ~37 trillion cells—each enclosed by a selective phospholipid bilayer membrane only two molecules thick.",
      yt: dayNum === 1 ? "3nAETHZTObk" : "Ptmlvtei8hw",
      ytLabel: dayNum === 1 ? "Watch: Nature of Science & Experimental Design | Amoeba Sisters" : "Watch: Cell Transport & Osmosis | Amoeba Sisters",
      textbookHtml: dayNum === 1
        ? `<h4 style="color:#15803d; margin:0 0 6px 0;">1. Anatomy of a Controlled Experiment &amp; Worked Example</h4><p><b>Qualitative</b> = sensory qualities (cloudy); <b>Quantitative</b> = numerical measurements (14.5 mm). <b>IV</b> = factor intentionally changed; <b>DV</b> = outcome measured; <b>Control Group</b> = baseline without treatment; <b>Constants</b> = factors held identical.<br><b>Worked Model (Oyster Study):</b> 40 oysters in Tank A (pH 8.1 normal) vs. 40 in Tank B (pH 7.6 acidic) at 18°C for 6 weeks → IV = Water pH; DV = Shell mass (g); Control = Tank A; Constants = 18°C, algae diet, 6 weeks.</p>`
        : `<h4 style="color:#15803d; margin:0 0 6px 0;">1. Selective Permeability &amp; Osmosis</h4><p>During <b>Osmosis</b>, water diffuses across a membrane from higher water concentration (<b>hypotonic</b>) toward higher solute concentration (<b>hypertonic</b>) until reaching <b>isotonic</b> equilibrium.</p>`,
      qc: [
        { q: "Classify: 'The bacterial colony grew to 14.5 mm after 24 hours.'", opts: ["Quantitative (QN)", "Qualitative (QL)", "Scientific Theory"], a: 0, r: "It uses exact numerical measurements with units (14.5 mm).", w: "Check Section 1 above." },
        { q: "In the Yeast Lab, what is the Independent Variable (IV)?", opts: ["Amount of sugar added (0, ½, or 2 tsp)", "Height of CO₂ foam (mm)", "Warm water temperature"], a: 0, r: "Sugar amount is the single factor deliberately changed across the 3 cups.", w: "Ask: What did we change on purpose?" },
        { q: "What happens to a freshwater cell placed in 35 ppt salt water?", opts: ["Water leaves the cell and it shrinks (plasmolysis)", "It bursts open", "Nothing moves"], a: 0, r: "Water moves toward the higher salt concentration outside the cell.", w: "Think about hypertonic salt solutions." }
      ],
      prompts: dayNum === 1
        ? [
            "1. Textbook Check: Write a formal 'If... then... because...' hypothesis predicting how warmer water affects a goldfish's gill/heart rate.",
            "2. At-Home Yeast Lab (Saccharomyces cerevisiae): Label 3 cups with ½ cup warm water (~105°F): Cup 1 Control (0 tsp sugar), Cup 2 (½ tsp sugar), Cup 3 (2 tsp sugar). Add ¾ tsp dry yeast to each, stir, and measure CO₂ foam height (mm) at 0, 10, and 20 min. (No yeast? Mix 2 tbsp baking soda + ½ cup vinegar in a balloon-topped bottle and measure gas expansion!).",
            "3. Post-Lab CER Conclusion (6–8 sentences): Identify IV, DV, and 3 constants, explain why Cup 1 was essential, and cite your exact measurements.",
            "4. 🌍 Global Explorer Bonus (+5 Extra Credit Points): Louis Pasteur proved living yeast drives fermentation while working in which French capital city?"
          ]
        : [
            "1. Osmosis & Homeostasis Analysis (8–10 sentences): Explain why hospitals use isotonic saline (0.9% NaCl) IV drips rather than pure distilled water, using Claim-Evidence-Reasoning.",
            "2. 🌍 Global Explorer Bonus (+5 Extra Credit Points): Robert Hooke coined the term 'cell' while viewing cork in which European capital city?"
          ]
    };
  }
  if (s.includes("stock") || s.includes("finance") || s.includes("invest")) {
    return {
      unitTitle: dayNum === 1 ? "UNIT 1 • CHAPTER 1.1: Stock Market Ground Zero — What Is a Share, Index Fund & Compound Growth?" : `UNIT 1 • LESSON 1.${dayNum}: Reading Stock Tickers, P/E Ratios & Risk Diversification`,
      objectives: ["Explain what owning a share of stock means and how index funds reduce single-company risk.", "Calculate compound growth and interpret basic stock ticker metrics (Price, Market Cap, P/E Ratio)."],
      hook: "If you invested $100/month starting at age 15 at an 8% average annual return, by age 65 you'd have over $790,000—having only put in $60,000 of your own cash!",
      yt: "p7HKvqRI_Bo",
      ytLabel: "Watch: How Does the Stock Market Work? | TED-Ed",
      textbookHtml: `<h4 style="color:#065f46; margin:0 0 6px 0;">1. Ground-Zero Investing: Stocks, Index Funds &amp; Compound Interest</h4><p>A <b>Stock (Share)</b> is a tiny piece of ownership in a real business (like Apple, ticker <code>AAPL</code>). An <b>Index Fund (S&amp;P 500)</b> bundles 500 top U.S. companies into one basket so one bad company cannot wipe you out. <b>Compound Interest</b> happens when your investment earnings generate their own earnings year after year.</p>`,
      qc: [
        { q: "What does buying 1 share of stock represent?", opts: ["Partial ownership in that company", "A guaranteed loan to the government", "A bank savings account"], a: 0, r: "Shareholders are part-owners of the business.", w: "Check Section 1 above." },
        { q: "Why do beginners use an S&P 500 Index Fund?", opts: ["Instant diversification across 500 companies", "It guarantees zero price drops", "It only buys one company"], a: 0, r: "Spreading money across 500 companies lowers single-stock risk.", w: "Re-read Section 1 above." },
        { q: "Why does starting to invest at age 15 beat starting at age 35?", opts: ["20 extra years of compound interest", "Stocks are cheaper for teens", "Taxes don't exist"], a: 0, r: "Time in the market multiplies compound growth.", w: "Check the Real-World Hook above." }
      ],
      prompts: [
        "1. Paper-Trading Starter Challenge: Pick 3 real companies you use every week, look up their stock ticker symbols, and explain in 6–8 sentences why owning a diversified S&P 500 index fund is safer than putting 100% into one stock.",
        "2. 🌍 Global Explorer Bonus (+5 Extra Credit Points): Which New York City street is home to the New York Stock Exchange (NYSE)?"
      ]
    };
  }

  const isSpa = s.includes("spanish");
  return {
    unitTitle: `UNIT 1 • LESSON 1.${dayNum}: ${subject} Immersion — Everyday Greetings & Café Conversation`,
    objectives: ["Listen to native pronunciation and repeat core survival phrases aloud.", "Write a realistic ordering conversation using taught vocabulary."],
    hook: "The fastest way to learn a language is immersion—hearing real everyday phrases first, repeating them out loud, and using them right away.",
    yt: isSpa ? (dayNum === 1 ? "DAp_v7EH9AA" : "lJw40EN6FXw") : "3wV8B4bx1lM",
    ytLabel: isSpa ? "Watch: Beginner Spanish Immersion Dialogue" : "Watch: Beginner Immersion Pronunciation",
    textbookHtml: isSpa
      ? `<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:8px; margin:8px 0;"><div onclick="speakWordInline('Buenos días','es-ES')" style="background:#f0fdf4; border:1px solid #86efac; padding:8px; border-radius:8px; cursor:pointer;"><b>🔊 Buenos días</b><br><small>Good morning</small></div><div onclick="speakWordInline('Quisiera dos tacos y agua, por favor','es-ES')" style="background:#f0fdf4; border:1px solid #86efac; padding:8px; border-radius:8px; cursor:pointer;"><b>🔊 Quisiera dos tacos y agua, por favor</b><br><small>I would like 2 tacos &amp; water, please</small></div><div onclick="speakWordInline('La cuenta, por favor. Muchas gracias','es-ES')" style="background:#f0fdf4; border:1px solid #86efac; padding:8px; border-radius:8px; cursor:pointer;"><b>🔊 La cuenta, por favor. Muchas gracias</b><br><small>The bill, please. Thank you very much</small></div></div>`
      : `<p>Tap any highlighted word below to hear native audio pronunciation and practice aloud!</p>`,
    qc: [
      { q: "How do you politely say 'I would like... please' in Spanish?", opts: ["Quisiera..., por favor", "La cuenta", "Buenos noches"], a: 0, r: "Quisiera..., por favor is polite and natural.", w: "Tap the green phrase cards above." },
      { q: "What does 'La cuenta, por favor' mean at a café?", opts: ["The bill/check, please", "Two tacos, please", "Good morning"], a: 0, r: "La cuenta means the bill/check.", w: "Check the third green card above." },
      { q: "How do you say 'Thank you very much'?", opts: ["Muchas gracias", "Por favor", "Quisiera"], a: 0, r: "Muchas gracias = Thank you very much.", w: "Review the cards above." }
    ],
    prompts: [
      "1. Immersion Café Dialogue (8–10 sentences): Write a polite café ordering conversation using today's phrase cards (Buenos días, Quisiera..., por favor, La cuenta, Muchas gracias).",
      "2. 🌍 Global Explorer Bonus (+5 Extra Credit Points): Which South American capital city at 2,850 meters elevation speaks Spanish alongside Kichwa in the Andes?"
    ]
  };
}
function renderStudentTodayPane() {
  const tabEl = document.getElementById("stuSubjectTabs");
  const paneEl = document.getElementById("stuActiveLessonPane");
  const progEl = document.getElementById("stuTodayProgress");
  if (!tabEl || !paneEl) return;
  if (!stuActiveAssignsCache.length) {
    tabEl.innerHTML = "";
    if (progEl) progEl.innerText = "0 / 0 Submitted";
    paneEl.innerHTML = "<div class='card'><p class='muted'>All enrolled lessons complete—or ask your parent to enroll your courses.</p></div>";
    return;
  }
  if (selectedStuSubjectIdx >= stuActiveAssignsCache.length) selectedStuSubjectIdx = 0;

  let doneToday = 0;
  tabEl.innerHTML = stuActiveAssignsCache.map((a, idx) => {
    const seq = window.stuAllBySubject[a.subject] || [a];
    const sub = stuSubsCache.find(x => String(x.assignment_id) === String(a.id));
    const isGraded = sub && (sub.status === "Graded" || (sub.grade && String(sub.grade).trim() !== ""));
    const isSub = sub && sub.status === "Submitted";
    if (isGraded || isSub) doneToday++;
    const badgeHtml = isGraded
      ? `<span style="background:#dcfce7; color:#15803d; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:700;">✅ Graded: ${sub.grade}</span>`
      : isSub
        ? `<span style="background:#fef3c7; color:#b45309; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:700;">⏳ Awaiting Parent Approval</span>`
        : `<span style="background:#dbeafe; color:#1d4ed8; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:700;">▶ Day ${seq.length} Ready</span>`;
    return `<button type="button" onclick="openStudentCourse(${idx})" style="display:flex; justify-content:space-between; align-items:center; width:100%; text-align:left; padding:14px 16px; border-radius:10px; border:1px solid #cbd5e1; background:#f8fafc; color:#0f172a; font-size:15px; font-weight:700; cursor:pointer;"><span>📘 ${a.subject} <small style="font-weight:500; color:#64748b;">(Day ${seq.length})</small></span><span>${badgeHtml} &nbsp;›</span></button>`;
  }).join("");
  if (progEl) progEl.innerText = doneToday + " / " + stuActiveAssignsCache.length + " Submitted";

  const menuCard = document.getElementById("stuCourseMenuCard");
  if (!window.stuCourseOpen) { if (menuCard) menuCard.classList.remove("hidden"); paneEl.innerHTML = ""; return; }
  if (menuCard) menuCard.classList.add("hidden");

  const activeLatest = stuActiveAssignsCache.at(selectedStuSubjectIdx) || stuActiveAssignsCache.at(0);
  const seq = window.stuAllBySubject[activeLatest.subject] || [activeLatest];
  const dayIdx = typeof window.stuViewDayOffset[activeLatest.subject] === "number" ? Math.max(0, Math.min(seq.length - 1, window.stuViewDayOffset[activeLatest.subject])) : (seq.length - 1);
  const a = seq.at(dayIdx) || activeLatest;
  const dayNum = dayIdx + 1;
  const khan = getKhanLessonContent(a.subject, dayNum, a.description);
    const sub = stuSubsCache.find(x => String(x.assignment_id) === String(a.id));
  const statusText = sub && (sub.status === "Graded" || sub.grade) ? "✅ Graded: " + sub.grade : sub && sub.status === "Submitted" ? "⏳ Submitted — Awaiting Parent Approval" : `Day ${dayNum} Active Lesson`;
  const ytHost = "www." + "youtube.com";
  const vidHtml = `<div style="margin:10px 0 14px 0; background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:10px;"><div style="font-weight:700; font-size:13px; color:#0f172a; margin-bottom:6px;">🎬 1. ${khan.ytLabel}</div><div style="position:relative; width:100%; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:8px; background:#000;"><iframe src="https://${ytHost}/embed/${khan.yt}?rel=0&playsinline=1" style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;" allowfullscreen playsinline></iframe></div></div>`;

  const docLinks = (a.resource_url || "").split(/[\r\n,]+/).map(u => u.replace(/^pdf:/i, "").trim()).filter(u => /^https?:\/\//i.test(u) && !u.includes("youtube") && !u.includes("youtu.be") && !u.includes("phet") && !u.includes("spanishdict") && !u.includes("louvre.fr"));
  const pdfBtnHtml = docLinks.length ? `<div style="margin:8px 0;">${docLinks.map(lnk => `<a href="${lnk}" target="_blank" rel="noopener" class="btn-outline" style="width:auto; display:inline-block; background:#eff6ff; color:#1d4ed8; border-color:#93c5fd; font-weight:700; text-decoration:none;">📖 Open Book / Reading PDF ↗</a>`).join(" ")}</div>` : "";

  const objHtml = `<div style="background:#f8fafc; border:1px solid #cbd5e1; border-left:4px solid #0f766e; padding:10px 14px; border-radius:8px; margin:10px 0;"><div style="font-weight:800; font-size:12px; color:#0f766e; text-transform:uppercase; margin-bottom:4px;">Chapter Learning Objectives</div><ul style="margin:0; padding-left:18px; font-size:13.5px; color:#1e293b;">${khan.objectives.map(o => `<li>${o}</li>`).join("")}</ul></div>`;
  const hookHtml = `<div style="background:#fefce8; border-left:4px solid #eab308; padding:10px 14px; border-radius:8px; margin:10px 0; color:#713f12; font-size:13.5px;"><b>💡 Real-World Hook:</b> ${khan.hook}</div>`;
  const readingSection = `<div style="margin:12px 0;"><div style="font-weight:800; font-size:14.5px; color:#0f172a; margin-bottom:6px;">📖 2. Read the Textbook Chapter</div>${pdfBtnHtml}<div style="background:#f8fafc; border:1px solid #cbd5e1; padding:14px; border-radius:10px; font-size:14px; line-height:1.65; color:#1e293b;">${injectInlinePronunciations(khan.textbookHtml, a.subject)}</div></div>`;

  const qcHtml = `<div style="background:#f0fdf4; border:1px solid #86efac; padding:12px 14px; border-radius:10px; margin:14px 0;"><div style="font-weight:800; color:#15803d; font-size:14px; margin-bottom:6px;">⚡ Instant Quick Check (Ungraded Self-Check)</div>${khan.qc.map((qItem, qi) => {
    const safeR = qItem.r.replace(/'/g, "\\'");
    const safeW = qItem.w.replace(/'/g, "\\'");
        return `<div style="margin:8px 0; padding:8px; background:#fff; border-radius:8px; border:1px solid #dcfce7;"><div style="font-weight:700; font-size:13.5px; color:#0f172a;">${qi + 1}. ${qItem.q}</div>${qItem.opts.map((opt, oi) => `<label style="display:block; margin:4px 0; font-size:13px; cursor:pointer;"><input type="radio" name="qc_${a.id}_${qi}" onclick="checkInstantQC('${a.id}', ${qi}, ${oi}, ${qItem.a}, '${safeR}', '${safeW}')" /> ${opt}</label>`).join("")}<div id="qc_fb_${a.id}_${qi}" style="margin-top:4px; padding:4px 8px; border-radius:6px; font-size:12.5px;"></div></div>`;
  }).join("")}</div>`;

  const isMath = !!khan.isMath || /algebra|geometry|calculus|math/i.test(a.subject || "");
  const mathToolkitHtml = isMath
    ? `<div style="margin:12px 0; padding:12px; background:#eff6ff; border:2px solid #93c5fd; border-radius:10px;"><div style="font-weight:800; color:#1e3a8a; margin-bottom:8px;">🧮 Interactive Math Toolkit &amp; Click-to-Plot Coordinate Grid</div><div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:10px;"><div style="background:#fff; padding:8px; border-radius:8px; border:1px solid #cbd5e1;"><div style="font-size:12px; font-weight:700; margin-bottom:4px;">Expression Calculator</div><div style="display:flex; gap:6px;"><input type="text" id="calcDisplay" placeholder="e.g., 24 / 3 * 2 + (5 - 8)^2" style="margin:0; flex:1;" /><button type="button" class="btn-primary" style="width:auto; padding:6px 12px;" onclick="runBackpackCalc()">=</button></div><div id="calcResult" style="margin-top:6px; font-weight:700; font-size:13px;">Result: —</div></div><div style="background:#fff; padding:8px; border-radius:8px; border:1px solid #cbd5e1;"><div style="font-size:12px; font-weight:700; margin-bottom:4px;">Interactive Grapher (Tap Grid to Plot Points or Enter m &amp; b)</div><div style="display:flex; gap:4px; align-items:center; margin-bottom:6px;"><b>m:</b><input type="number" id="graphM" value="2" step="0.5" style="width:55px; margin:0;" oninput="drawBackpackLine()" /><b>b:</b><input type="number" id="graphB" value="0" step="1" style="width:55px; margin:0;" oninput="drawBackpackLine()" /><button type="button" class="btn-outline" style="width:auto; padding:4px 8px; font-size:11px;" onclick="window.stuGridPoints['${a.id}']=[]; drawInteractiveGrid('${a.id}')">Clear</button></div><canvas id="slopeCanvas" width="240" height="160" onclick="handleGridTap(event, '${a.id}')" style="width:100%; max-width:260px; border:1px solid #94a3b8; border-radius:6px; background:#fff; cursor:crosshair;"></canvas><div id="gridCoords-${a.id}" style="font-size:11.5px; color:#1e3a8a; font-weight:700; margin-top:4px;">Plotted Points: None (tap grid to plot)</div></div></div></div>`
    : "";

  const promptsHtml = `<div style="margin:14px 0;"><div style="font-weight:800; font-size:14.5px; color:#0f172a; margin-bottom:8px;">✍️ 3. Honors Workbook &amp; Application Prompts</div>${khan.prompts.map((pr, pi) => `<div style="margin:10px 0; padding:10px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px;"><div style="font-weight:700; font-size:13.5px; color:#0f172a; margin-bottom:6px;">${injectInlinePronunciations(pr, a.subject)}</div><textarea class="wb-ans-${a.id}" data-q="${pr.replace(/"/g, "&quot;")}" rows="${isMath ? 2 : 4}" placeholder="Enter your answer here..."></textarea></div>`).join("")}</div>`;

  const fbHtml = sub && sub.parent_feedback ? `<div style="background:#ecfdf5; border:1px solid #86efac; padding:10px; border-radius:8px; margin-top:10px; color:#065f46;"><b>💬 Parent Feedback:</b> ${sub.parent_feedback}</div>` : "";
  const safeSubjAttr = a.subject.replace(/'/g, "\\'");
  const navBar = `<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid #e2e8f0;"><button type="button" class="btn-outline" style="width:auto; color:#0f172a; font-weight:700;" onclick="closeStudentCourseMenu()">← All Courses</button><div style="display:flex; align-items:center; gap:8px;"><button type="button" class="btn-outline" style="width:auto; padding:6px 12px; color:#0f172a;" ${dayIdx === 0 ? "disabled" : ""} onclick="shiftStudentDay('${safeSubjAttr}', -1, ${seq.length})">◀ Day ${Math.max(1, dayNum - 1)}</button><span class="badge" style="background:#1e3a8a; color:#ffffff;">Day ${dayNum} of ${seq.length}</span><button type="button" class="btn-outline" style="width:auto; padding:6px 12px; color:#0f172a;" ${dayIdx >= seq.length - 1 ? "disabled" : ""} onclick="shiftStudentDay('${safeSubjAttr}', 1, ${seq.length})">Day ${Math.min(seq.length, dayNum + 1)} ▶</button></div></div>`;

  paneEl.innerHTML = `<div class="card">${navBar}<div style="background:#1e3a8a; color:#ffffff; padding:14px; border-radius:10px; margin-bottom:10px;"><div style="font-size:11.5px; letter-spacing:0.6px; text-transform:uppercase; opacity:0.85;">${a.subject} • ${a.course_level || "Honors"} (${a.credits || 1} cr) • ${statusText}</div><div style="font-size:17px; font-weight:800; margin-top:4px;">${khan.unitTitle}</div></div>${objHtml}${hookHtml}${vidHtml}${readingSection}${mathToolkitHtml}${qcHtml}${promptsHtml}<textarea id="subnote-${a.id}" class="hidden">${sub && sub.student_notes ? sub.student_notes : ""}</textarea><label style="font-weight:700; color:#0f172a;">📸 Upload Photo of Paper Work / Lab Setup (Optional):</label><input type="file" id="subphoto-${a.id}" accept="image/*" /><button type="button" class="btn-primary" style="margin-top:10px;" onclick="collectAndSubmitWork('${a.id}')">${sub ? "🔄 Update & Re-Submit Work" : "✅ Submit Work for Parent Approval"}</button>${fbHtml}</div>`;
  if (isMath && typeof drawInteractiveGrid === "function") setTimeout(() => drawInteractiveGrid(a.id), 50);
}

function handleGridTap(ev, assignId) {
  const r = c.getBoundingClientRect();
  const px = (ev.clientX - r.left) * (c.width / r.width);
  const py = (ev.clientY - r.top) * (c.height / r.height);
  const gx = Math.round((px - c.width / 2) / 12);
  const gy = Math.round((c.height / 2 - py) / 12);
  if (!window.stuGridPoints[assignId]) window.stuGridPoints[assignId] = [];
  window.stuGridPoints[assignId].push({ x: gx, y: gy });
  drawInteractiveGrid(assignId);
}

function drawInteractiveGrid(assignId) {
  const c = document.getElementById("slopeCanvas");
  if (!c) return;
  const ctx = c.getContext("2d");
  const w = c.width, h = c.height, cx = w / 2, cy = h / 2;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "#e2e8f0";
  for (let x = cx % 12; x < w; x += 12) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = cy % 12; y < h; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.strokeStyle = "#64748b";
  ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
  const pts = window.stuGridPoints[assignId] || [];
  ctx.fillStyle = "#dc2626";
  pts.forEach(p => { ctx.beginPath(); ctx.arc(cx + p.x * 12, cy - p.y * 12, 4, 0, Math.PI * 2); ctx.fill(); });
  if (pts.length >= 2) {
    ctx.strokeStyle = "#2563eb"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx + pts.at(0).x * 12, cy - pts.at(0).y * 12); ctx.lineTo(cx + pts.at(-1).x * 12, cy - pts.at(-1).y * 12); ctx.stroke();
  }
  const lbl = document.getElementById("gridCoords-" + assignId);
  if (lbl) lbl.innerText = pts.length ? "Plotted Points: " + pts.map(p => `(${p.x}, ${p.y})`).join(", ") : "Plotted Points: None (tap grid to plot)";
}

function collectAndSubmitWork(assignId) {
  const boxes = Array.from(document.querySelectorAll(".wb-ans-" + assignId));
  const lines = boxes.map(b => (b.getAttribute("data-q") || "Prompt") + "\nAnswer: " + (b.value.trim() || "(Left blank)"));
  const pts = window.stuGridPoints[assignId] || [];
  if (pts.length) lines.push("Plotted Graph Coordinates: " + pts.map(p => `(${p.x}, ${p.y})`).join(" -> "));
  const target = document.getElementById("subnote-" + assignId);
  if (target) target.value = lines.join("\n\n");
  submitWork(assignId);
}



async function loadStudentDashboard(isPreview = false) {
  if (!isPreview) saveSession("student");
  document.getElementById("authSection").classList.add("hidden");
  document.getElementById("studentDashboard").classList.remove("hidden");
  document.getElementById("logoutBtn").classList.remove("hidden");

  let banner = document.getElementById("previewBanner");
  if (isPreview) {
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "previewBanner";
      banner.style.cssText = "background:#fef08a; border:1px solid #eab308; padding:10px 14px; border-radius:10px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; color:#713f12;";
      document.getElementById("studentDashboard").prepend(banner);
    }
    banner.innerHTML = '<span><b>👀 Parent Preview Mode</b> — Viewing as <b>' + currentUser.full_name + '</b></span><button class="btn-outline" style="background:#fff; color:#0f172a; padding:6px 12px;" onclick="exitStudentPreview()">← Back to Parent Portal</button>';
  } else if (banner) {
    banner.remove();
  }

  document.getElementById("stuDashWelcome").innerText = "Welcome, " + currentUser.full_name;
  document.getElementById("stuDashMeta").innerText = currentFamily.family_name + " • " + currentUser.grade_level + " Grade • Class of " + (currentUser.expected_grad_year || currentUser.grad_year || "2028");

  let famAssigns = await sbQuery("assignments", {
    query: `family_id=eq.${currentFamily.id}&select=*&order=created_at.asc`
  }).catch(() => null);

  if (!Array.isArray(famAssigns)) {
    famAssigns = Array.isArray(assignmentsCache) ? assignmentsCache : [];
  }

  const allAssigns = famAssigns.filter(a => !a.student_id || String(a.student_id) === String(currentUser.id));

  let freshSubs = await sbQuery("submissions", {
    query: `student_id=eq.${currentUser.id}&select=*`
  }).catch(() => null);

  const subs = Array.isArray(freshSubs)
    ? freshSubs
    : (Array.isArray(submissionsCache) ? submissionsCache.filter(s => String(s.student_id) === String(currentUser.id)) : []);

  const achs = (await sbQuery("achievements", {
    query: `student_id=eq.${currentUser.id}&select=*`
  }).catch(() => [])) || [];

  stuSubsCache = subs;

        const bySubject = {};
  allAssigns.forEach(a => {
    const subjKey = (a.subject || "General").trim();
    if (!bySubject[subjKey]) bySubject[subjKey] = [];
    bySubject[subjKey].push(a);
  });

  const activeAssigns = [];
  for (const subj of Object.keys(bySubject)) {
    const seq = bySubject[subj];
    let nextItem = seq.find(item => {
      const s = subs.find(x => String(x.assignment_id) === String(item.id));
      return !(s && (s.status === "Submitted" || s.status === "Graded" || (s.grade && String(s.grade).trim() !== "")));
    });
      if (!nextItem && seq.length > 0 && seq.length < 45) {
    const nextDayNum = seq.length + 1;
    const isWeeklyQuiz = nextDayNum % 5 === 0;
    const template = seq.at(0) || {};
    const topicHint = getKhanLessonContent(subj, nextDayNum, "").unitTitle.replace(/^UNIT\s*\d+\s*•\s*(?:CHAPTER|LESSON)\s*[\d.]+:\s*/i, "");
    const newTitle = `[Q1 • Day ${nextDayNum}] ${isWeeklyQuiz ? "Weekly Auto-Graded Mastery Quiz" : topicHint}`;
    const created = await sbQuery("assignments", {
      method: "POST",
      body: {
        family_id: currentFamily.id,
        student_id: template.student_id || currentUser.id,
        quarter: template.quarter || "Q1",
        subject: subj,
        course_level: template.course_level || "Honors",
        credits: template.credits || 1.0,
        title: newTitle,
        description: `DAY ${nextDayNum} HONORS LESSON: Complete the textbook reading, video, instant quick check, and workbook prompts.`,
        resource_url: template.resource_url || ""

        }
      }).catch(() => null);
      if (created && created.id) {
        seq.push(created);
        allAssigns.push(created);
        nextItem = created;
      } else {
        const memItem = {
          ...template,
          id: "auto-" + subj.replace(/\W+/g, "") + "-d" + nextDayNum,
          title: newTitle,
          description: `DAY ${nextDayNum} HONORS LESSON: Read the self-contained lesson chapter, watch the embedded video below, and complete the Honors analytical exercises.`
        };
        seq.push(memItem);
        allAssigns.push(memItem);
        nextItem = memItem;
      }
    }
    if (!nextItem) nextItem = seq[seq.length - 1];
    if (nextItem) activeAssigns.push(nextItem);
  }
  stuActiveAssignsCache = activeAssigns;
  selectedStuSubjectIdx = 0;
  renderStudentTodayPane();


  const portElEarly = document.getElementById("studentPortfolioList");
  if (portElEarly) {
    const diplomaCard =
      '<div class="item-card" style="border:2px solid #1e3a8a; background:#f8fafc; margin-bottom:14px;">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">' +
          '<div>' +
            '<div style="font-size:12px; font-weight:700; color:#1e3a8a; letter-spacing:0.06em;">OFFICIAL COLLEGE-PREP CREDENTIAL</div>' +
            '<div style="font-size:17px; font-weight:800; color:#0f172a; margin:2px 0;">🎓 High School Diploma — ' + currentUser.full_name + '</div>' +
          '</div>' +
          '<button type="button" class="btn-primary" style="width:auto; padding:8px 14px;" onclick="printDiplomaOnly()">🖨️ Print / Save PDF</button>' +
        '</div>' +
        buildDiplomaCardHtml(currentUser, currentFamily) +
      '</div>';

    const achHtml = achs.map(ac => {
      const met = ac.metric ? " &bull; " + ac.metric : "";
      const loc = ac.location ? " &bull; 📍 " + ac.location : "";
      return '<div class="item-card"><strong>[' + ac.type + '] ' + ac.title + '</strong><br><small class="muted">' + (ac.date_completed || "") + loc + met + '</small></div>';
    }).join("") || "<p class='muted'>No travel study or certifications logged yet.</p>";

    portElEarly.innerHTML = diplomaCard + achHtml;
  }
    const getDetailedSyllabusHtml = (subj, items) => {
    const s = (subj || "").toLowerCase();
    const firstTitle = String((items && items.title) || subj).replace(/^\[[^\]]+\]\s*/, "");
    if (s.includes("literature") || s.includes("english")) {
      return '<li><b>Weeks 1–2 (Dystopian Foundations &amp; Censorship):</b> ' + firstTitle + ' • <i>Ray Bradbury’s Fahrenheit 451</i> Part 1 (pp. 1–55) • <b>Fridays:</b> Weekly Auto-Graded Reading &amp; Literary Analysis Quiz</li>' +
        '<li><b>Weeks 3–4 (Media Saturation &amp; Conformity):</b> <i>Fahrenheit 451</i> Part 2 (pp. 66–103) &amp; rhetorical analysis comparing mid-century print vs. 2026 algorithmic feeds • <b>Due End of Week 4:</b> Annotated Evidence Passage Portfolio</li>' +
        '<li><b>Weeks 5–6 (Resistance, Memory &amp; Cultural Preservation):</b> <i>Fahrenheit 451</i> Part 3 (pp. 104–158) &amp; Socratic Seminar • <b>Due End of Week 6:</b> 1,200-Word Analytical Essay Draft</li>' +
        '<li><b>Weeks 7–8 (Contemporary Voices &amp; Comparative Synthesis):</b> Paired nonfiction essays on free expression &amp; information literacy • <b>Due Week 8:</b> Final Revised Essay &amp; Multimedia Presentation</li>' +
        '<li><b>Week 9 (Quarter Mastery &amp; Capstone):</b> Comprehensive Quarter Exam, Oral Passage Defense &amp; Transcript Review</li>';
    }
    if (s.includes("algebra") || s.includes("geometry") || s.includes("calculus") || s.includes("math")) {
      return '<li><b>Weeks 1–2 (Foundations, Expressions &amp; Linear Models):</b> ' + firstTitle + ' • Order of operations, variables, slope-intercept &amp; point-slope forms • <b>Fridays:</b> Weekly Auto-Graded Problem-Solving Quiz</li>' +
        '<li><b>Weeks 3–4 (Systems of Equations &amp; Inequalities):</b> Substitution, elimination, linear inequalities &amp; Desmos/Line-Grapher modeling • <b>Due End of Week 4:</b> Real-World Cost &amp; Break-Even Modeling Project</li>' +
        '<li><b>Weeks 5–6 (Exponents, Polynomials &amp; Factoring):</b> Exponent laws, polynomial operations, factoring quadratics &amp; zero-product property • <b>Week 6:</b> Mid-Quarter Cumulative Skills Check</li>' +
        '<li><b>Weeks 7–8 (Quadratic Functions, Radicals &amp; Applications):</b> Vertex form, quadratic formula, projectile motion &amp; data regression • <b>Due Week 8:</b> Applied STEM Data Analysis Project</li>' +
        '<li><b>Week 9 (Quarter Mastery &amp; Capstone):</b> Comprehensive Quarter Exam (Show-All-Steps Paper &amp; Digital Assessment)</li>';
    }
    if (s.includes("marine")) {
      return '<li><b>Weeks 1–2 (Physical Oceanography, Salinity &amp; Currents):</b> ' + firstTitle + ' • Thermohaline circulation, 35 ppt seawater chemistry &amp; inland/coastal salinity lab • <b>Fridays:</b> Weekly Auto-Graded Lab &amp; Concept Quiz</li>' +
        '<li><b>Weeks 3–4 (Pelagic Zones, Plankton &amp; Marine Food Webs):</b> Primary productivity, trophic cascades, hydrothermal vents &amp; deep-sea adaptations • <b>Due End of Week 4:</b> Marine Trophic Energy Pyramid &amp; Field/Simulation Report</li>' +
        '<li><b>Weeks 5–6 (Coral Reefs, Estuaries &amp; Ocean Acidification):</b> Carbonate buffering, pH shifts, coastal wetlands &amp; biodiversity • <b>Week 6:</b> Mid-Quarter Lab Practical</li>' +
        '<li><b>Weeks 7–8 (Human Impact, Fisheries &amp; Marine Conservation):</b> Sustainable fisheries, plastic gyres, coral restoration &amp; marine policy • <b>Due Week 8:</b> Ocean Conservation Action Proposal</li>' +
        '<li><b>Week 9 (Quarter Mastery &amp; Capstone):</b> Comprehensive Quarter Exam, Lab Data Defense &amp; Portfolio Review</li>';
    }
    if (s.includes("biology")) {
      return '<li><b>Weeks 1–2 (Nature of Science, Experimental Design &amp; Macromolecules):</b> ' + firstTitle + ' • Variables, controls, yeast metabolism lab &amp; biological polymers • <b>Fridays:</b> Weekly Auto-Graded Concept &amp; Lab Quiz</li>' +
        '<li><b>Weeks 3–4 (Cell Structure, Membranes &amp; Transport):</b> Prokaryotic vs. eukaryotic cells, osmosis, diffusion &amp; cellular homeostasis • <b>Due End of Week 4:</b> Osmosis &amp; Cell Transport Lab Report (CER Format)</li>' +
        '<li><b>Weeks 5–6 (Cellular Energetics — Photosynthesis &amp; Respiration):</b> ATP synthesis, chloroplasts, mitochondria &amp; fermentation • <b>Week 6:</b> Mid-Quarter Cumulative Assessment</li>' +
        '<li><b>Weeks 7–8 (DNA Replication, Cell Cycle &amp; Mitosis):</b> Nucleic acids, checkpoints, cancer biology &amp; chromosome modeling • <b>Due Week 8:</b> Molecular Genetics Case Study</li>' +
        '<li><b>Week 9 (Quarter Mastery &amp; Capstone):</b> Comprehensive Quarter Exam, Lab Notebook Audit &amp; Oral Defense</li>';
    }
    if (s.includes("history")) {
      return '<li><b>Weeks 1–2 (Historical Thinking, Primary Sources &amp; Early Law Codes):</b> ' + firstTitle + ' • HIPP primary-source analysis, Hammurabi’s Code &amp; Mesopotamian/river-valley governance • <b>Fridays:</b> Weekly Auto-Graded Document &amp; Chronology Quiz</li>' +
        '<li><b>Weeks 3–4 (Classical Empires, Trade Networks &amp; Philosophy):</b> Mediterranean, Silk Road, Indian Ocean trade &amp; comparative statecraft • <b>Due End of Week 4:</b> Primary-Source Corroboration Brief</li>' +
        '<li><b>Weeks 5–6 (Global Encounters, Colonization &amp; Unfiltered Primary Accounts):</b> Indigenous sovereignty, transatlantic exchange &amp; firsthand chronicles • <b>Week 6:</b> Document-Based Question (DBQ) Essay</li>' +
        '<li><b>Weeks 7–8 (Revolutions, Constitutionalism &amp; Industrial Transformation):</b> Enlightenment debates, global independence movements &amp; labor shifts • <b>Due Week 8:</b> Historical Investigation Research Project</li>' +
        '<li><b>Week 9 (Quarter Mastery &amp; Capstone):</b> Comprehensive Quarter Exam, Primary-Source Defense &amp; Transcript Review</li>';
    }
    if (s.includes("mandarin") || s.includes("chinese") || s.includes("hindi") || s.includes("spanish") || s.includes("french")) {
      return '<li><b>Weeks 1–2 (Phonetics, Tones/Script &amp; Essential Greetings):</b> ' + firstTitle + ' • Pronunciation drills, native audio practice &amp; self-introductions • <b>Fridays:</b> Weekly Auto-Graded Vocabulary &amp; Listening Quiz</li>' +
        '<li><b>Weeks 3–4 (Family, Daily Routines &amp; Numbers/Time):</b> Core sentence structures, question words &amp; conversational dialogues • <b>Due End of Week 4:</b> Recorded 2-Minute Spoken Introduction</li>' +
        '<li><b>Weeks 5–6 (Food, Travel, Directions &amp; Cultural Etiquette):</b> Ordering, navigating cities &amp; authentic cultural case studies • <b>Week 6:</b> Mid-Quarter Reading &amp; Dialogue Assessment</li>' +
        '<li><b>Weeks 7–8 (Storytelling, Past/Future Expressions &amp; Media):</b> Short cultural readings, pen-pal/journal entries &amp; real-world scenarios • <b>Due Week 8:</b> Cultural Immersion &amp; Conversation Project</li>' +
        '<li><b>Week 9 (Quarter Mastery &amp; Capstone):</b> Comprehensive Quarter Exam (Reading, Writing &amp; Oral Proficiency Check)</li>';
    }
    return '<li><b>Weeks 1–2 (Foundations &amp; Core Frameworks):</b> ' + firstTitle + ' • <b>Fridays:</b> Weekly Auto-Graded Mastery Quiz</li>' +
      '<li><b>Weeks 3–4 (Applied Analysis &amp; Guided Practice):</b> Primary-source / quantitative problem-solving • <b>Due End of Week 4:</b> Mid-Quarter Applied Project</li>' +
      '<li><b>Weeks 5–6 (Deep-Dive Inquiry &amp; Synthesis):</b> Comparative case studies &amp; structured exercises • <b>Week 6:</b> Cumulative Skills Check</li>' +
      '<li><b>Weeks 7–8 (Independent Research &amp; Real-World Application):</b> Capstone investigation &amp; analytical portfolio • <b>Due Week 8:</b> Final Project Submission</li>' +
      '<li><b>Week 9 (Quarter Mastery &amp; Capstone):</b> Comprehensive Quarter Exam, Oral Defense &amp; Transcript Review</li>';
  };

  const syllabusEl = document.getElementById("stuSyllabusList");
  if (syllabusEl) {
    syllabusEl.innerHTML = Object.keys(bySubject).map(subj => {
      const items = bySubject[subj];
          const first = items.at(0) || {};
      const weekListHtml = getDetailedSyllabusHtml(subj, items);
      return '<div class="item-card">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">' +
          '<div><strong>' + subj + '</strong> <span class="badge">' + (first.course_level || "Honors") + ' • ' + (first.credits || 1.0) + ' Cr</span></div>' +
          '<span style="font-size:12px; color:#64748b;">' + items.length + ' Lesson(s) Assigned</span>' +
        '</div>' +
        '<ul style="margin:8px 0 0 18px; padding:0; font-size:13.5px; color:#334155; line-height:1.55;">' + weekListHtml + '</ul>' +
      '</div>';
    }).join("") || "<p class='muted'>No quarter syllabus items enrolled yet.</p>";
  }

    window.stuAllBySubject = bySubject;
  const studyKey = "gph_study_days_" + (currentUser.id || "stu");
  const todayStr = new Date().toISOString().slice(0, 10);
  const studyDays = JSON.parse(localStorage.getItem(studyKey) || "[]");
  if (!studyDays.includes(todayStr)) {
    studyDays.push(todayStr);
    localStorage.setItem(studyKey, JSON.stringify(studyDays));
  }
  const streakEl = document.getElementById("stuStudyDaysBadge");
  if (streakEl) streakEl.innerText = "🔥 " + studyDays.length + (studyDays.length === 1 ? " Day Studied" : " Days Studied");

  const gradesEl = document.getElementById("stuGradesList");
  const gpaBadge = document.getElementById("stuGpaBadge");
  if (gradesEl) {
    let ptsSum = 0;
    let crSum = 0;
    const parseNumGrade = (g) => {
      const str = String(g || "").trim().toUpperCase();
      const m = str.match(/(\d+(?:\.\d+)?)/);
      if (m) return parseFloat(m);
      if (str.startsWith("A+")) return 99;
      if (str.startsWith("A-")) return 91;
      if (str.startsWith("A")) return 95;
      if (str.startsWith("B+")) return 88;
      if (str.startsWith("B-")) return 81;
      if (str.startsWith("B")) return 85;
      if (str.startsWith("C")) return 75;
      if (str.startsWith("D")) return 65;
      return null;
    };

    gradesEl.innerHTML = Object.keys(bySubject).map(subj => {
      const items = bySubject[subj];
          const first = items.at(0) || {};
      const gradedItems = [];
      let subjScoreSum = 0;
      items.forEach((item, idx) => {
        const sub = subs.find(s => String(s.assignment_id) === String(item.id));
        const num = sub && sub.grade ? parseNumGrade(sub.grade) : null;
        if (num !== null) {
          gradedItems.push({ day: idx + 1, title: item.title, grade: sub.grade, num, fb: sub.parent_feedback || "" });
          subjScoreSum += num;
        }
      });
      const avgPct = gradedItems.length ? Math.round((subjScoreSum / gradedItems.length) * 10) / 10 : null;
      const letter = avgPct === null ? "In Progress" : avgPct >= 90 ? "A" : avgPct >= 80 ? "B" : avgPct >= 70 ? "C" : avgPct >= 60 ? "D" : "F";
      if (avgPct !== null && typeof gradeToPoints === "function") {
        const cr = parseFloat(first.credits) || 1.0;
        ptsSum += gradeToPoints(String(avgPct), first.course_level) * cr;
        crSum += cr;
      }
      const badgeStr = avgPct !== null ? `${avgPct}% (${letter}) • Running Quarter Avg` : "In Progress";
      const breakdownHtml = gradedItems.length
        ? gradedItems.map(g => `<div style="font-size:13px; color:#334155; margin-top:6px; padding-left:10px; border-left:2px solid #93c5fd;">• <b>Day ${g.day}:</b> ${g.grade}${g.fb ? ` — <span style="color:#15803d;">"${g.fb}"</span>` : ""}</div>`).join("")
        : `<div class="muted" style="font-size:13px; margin-top:6px;">No graded assignments recorded yet for this course.</div>`;

      return `<div class="item-card">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div><strong style="font-size:15px; color:#0f172a;">${subj}</strong> <span class="badge">${first.course_level || "Honors"} • ${first.credits || 1} cr</span></div>
          <span class="badge" style="background:${avgPct !== null ? "#dcfce7" : "#f1f5f9"}; color:${avgPct !== null ? "#15803d" : "#475569"}; font-weight:700;">${badgeStr}</span>
        </div>
        ${breakdownHtml}
      </div>`;
    }).join("") || "<p class='muted'>No courses enrolled yet.</p>";
    if (gpaBadge) gpaBadge.innerText = "Cumulative GPA: " + (crSum > 0 ? (ptsSum / crSum).toFixed(2) : "-");
  }
    const portEl = document.getElementById("studentPortfolioList");
  if (portEl) {
    const diplomaCard =
      '<div class="item-card" style="border:2px solid #1e3a8a; background:#f8fafc; margin-bottom:14px;">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">' +
          '<div>' +
            '<div style="font-size:12px; font-weight:700; color:#1e3a8a; letter-spacing:0.06em;">OFFICIAL COLLEGE-PREP CREDENTIAL</div>' +
            '<div style="font-size:17px; font-weight:800; color:#0f172a; margin:2px 0;">🎓 High School Diploma — ' + currentUser.full_name + '</div>' +
          '</div>' +
          '<button type="button" class="btn-primary" style="width:auto; padding:8px 14px;" onclick="printDiplomaOnly()">🖨️ Print / Save PDF</button>' +
        '</div>' +
        buildDiplomaCardHtml(currentUser, currentFamily) +
      '</div>';

    const achHtml = achs.map(ac => {
      const met = ac.metric ? " &bull; " + ac.metric : "";
      const loc = ac.location ? " &bull; 📍 " + ac.location : "";
      return '<div class="item-card"><strong>[' + ac.type + '] ' + ac.title + '</strong><br><small class="muted">' + (ac.date_completed || "") + loc + met + '</small></div>';
    }).join("") || "<p class='muted'>No travel study or certifications logged yet.</p>";

    portEl.innerHTML = diplomaCard + achHtml;
  }
}
async function compressPhotoToDataUrl(file) {

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxW = 900;
        const scale = img.width > maxW ? maxW / img.width : 1;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function submitWork(assignment_id) {
  const noteEl = document.getElementById("subnote-" + assignment_id);
  const notes = noteEl ? noteEl.value.trim() : "";
  const photoInput = document.getElementById("subphoto-" + assignment_id);
  const keepIdx = typeof selectedStuSubjectIdx === "number" ? selectedStuSubjectIdx : 0;
  let link = "";
  if (photoInput && photoInput.files && photoInput.files[0]) {
    link = await compressPhotoToDataUrl(photoInput.files[0]);
  }
  try {
    const existing = await sbQuery("submissions", {
      query: `assignment_id=eq.${assignment_id}&student_id=eq.${currentUser.id}&select=*`,
      single: true
    });
    const finalLink = link || (existing && existing.submission_link ? existing.submission_link : "");
    if (existing) {
      await sbQuery("submissions", {
        method: "PATCH",
        query: `id=eq.${existing.id}`,
        body: { student_notes: notes, submission_link: finalLink, status: "Submitted" }
      });
    } else {
      await sbQuery("submissions", {
        method: "POST",
        body: { assignment_id, student_id: currentUser.id, student_notes: notes, submission_link: finalLink, status: "Submitted" }
      });
    }
    const isPrev = !!(document.getElementById("previewBanner") && !document.getElementById("previewBanner").classList.contains("hidden"));
    await loadStudentDashboard(isPrev);
    selectedStuSubjectIdx = keepIdx;
    renderStudentTodayPane();
    const pane = document.getElementById("stuActiveLessonPane");
    if (pane) {
      const toast = document.createElement("div");
      toast.style.cssText = "background:#ecfdf5; border:2px solid #10b981; color:#065f46; padding:12px 16px; border-radius:10px; font-weight:700; margin-bottom:14px;";
      toast.innerText = "✅ Your work has been submitted and is awaiting parent approval!";
      pane.prepend(toast);
    }
    alert("✅ Your work has been submitted and is awaiting parent approval!");
  } catch (err) {
    alert(err.message);
  }
}
const BRAIN_BREAKS = [
  { type: "😂 Clean Nerd Joke", prompt: "Why was the obtuse angle always so frustrated?", reveal: "Because it was never right!" },
  { type: "😂 Clean Nerd Joke", prompt: "Why did the biologist break up with the physicist?", reveal: "They had no chemistry." },
  { type: "🧩 60-Second Riddle", prompt: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", reveal: "An echo!" },
  { type: "🧩 60-Second Riddle", prompt: "What has cities, but no houses; mountains, but no trees; and water, but no fish?", reveal: "A map (every worldschooler's best friend)!" },
  { type: "🤔 Traveler's Would You Rather", prompt: "Would you rather have a free lifetime pass to every museum in the world OR a free lifetime rail pass across every continent?", reveal: "No wrong answer—pitch your choice to your parent at lunch!" },
  { type: "🤔 Traveler's Would You Rather", prompt: "Would you rather time-travel for 24 hours to Ancient Babylon (1750 BCE) OR 100 years into the future?", reveal: "Bonus thought: Which one would be safer without modern Wi-Fi?" },
  { type: "⚡ Optional 2-Minute Movement Reset", prompt: "Optional Physical Reset (skip or adapt freely for any mobility or health need): Stand up, reach both arms overhead for 10 seconds, roll your shoulders back 5 times, and take 3 slow deep breaths away from your screen.", reveal: "Brain oxygen refilled—you're ready to crush your next step!" }
];

function revealBrainBreak() {
  const el = document.getElementById("bbReveal");
  if (el) el.classList.remove("hidden");
}

function triggerBrainBreak() {
  const box = document.getElementById("brainBreakBox");
  const item = BRAIN_BREAKS.at(Math.floor(Math.random() * BRAIN_BREAKS.length));
  box.classList.remove("hidden");
  const revealBtn = item.reveal && String(item.reveal).trim()
    ? '<button type="button" class="btn-outline" style="width:auto; color:#1e293b; font-size:12px;" onclick="revealBrainBreak()">👀 Show Punchline / Answer</button><p id="bbReveal" class="hidden" style="margin-top:8px; font-weight:700; color:#15803d;">' + item.reveal + '</p>'
    : '';
  box.innerHTML =
    '<div style="display:flex; justify-content:space-between; align-items:center;"><strong>' + item.type + '</strong><button type="button" style="width:auto; background:transparent; border:none; font-weight:700; cursor:pointer;" onclick="document.getElementById(\'brainBreakBox\').classList.add(\'hidden\')">✕</button></div>' +
    '<p style="margin:8px 0;">' + item.prompt + '</p>' + revealBtn;
}

function toggleMathToolkit() {
  const box = document.getElementById("mathToolkitBox");
  box.classList.toggle("hidden");
  if (!box.classList.contains("hidden")) drawBackpackLine();
}

function evalMathSafe(expr) {
  const s = String(expr || "").replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  if (!s) throw new Error("Enter an expression");
  let pos = 0;
  function parseExpr() {
    let val = parseTerm();
    while (pos < s.length && (s[pos] === "+" || s[pos] === "-")) {
      const op = s[pos++];
      const right = parseTerm();
      val = op === "+" ? val + right : val - right;
    }
    return val;
  }
  function parseTerm() {
    let val = parsePower();
    while (pos < s.length && (s[pos] === "*" || s[pos] === "/")) {
      const op = s[pos++];
      const right = parsePower();
      if (op === "/" && right === 0) throw new Error("Cannot divide by zero");
      val = op === "*" ? val * right : val / right;
    }
    return val;
  }
  function parsePower() {
    let base = parseUnary();
    if (pos < s.length && s[pos] === "^") {
      pos++;
      const exp = parsePower();
      return Math.pow(base, exp);
    }
    return base;
  }
  function parseUnary() {
    if (s[pos] === "+") { pos++; return parseUnary(); }
    if (s[pos] === "-") { pos++; return -parseUnary(); }
    return parseAtom();
  }
  function parseAtom() {
    if (s[pos] === "(") {
      pos++;
      const val = parseExpr();
      if (s[pos] !== ")") throw new Error("Missing closing )");
      pos++;
      return val;
    }
    const start = pos;
    while (pos < s.length && ((s[pos] >= "0" && s[pos] <= "9") || s[pos] === ".")) pos++;
    if (start === pos) throw new Error("Invalid character");
    return parseFloat(s.slice(start, pos));
  }
  const result = parseExpr();
  if (pos !== s.length) throw new Error("Unexpected input");
  return Math.round(result * 1000000) / 1000000;
}

function runBackpackCalc() {
  const inp = document.getElementById("calcDisplay");
  const out = document.getElementById("calcResult");
  if (!inp || !out) return;
  const raw = inp.value.trim();
  if (!raw) { out.innerText = "Result: —"; return; }
  try {
    const val = evalMathSafe(raw);
    out.style.color = "#15803d";
    out.innerText = "Result: " + val;
  } catch (e) {
    out.style.color = "#b91c1c";
    out.innerText = "Check expression: " + e.message;
  }
}


function drawBackpackLine() {
  const canvas = document.getElementById("slopeCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const m = parseFloat(document.getElementById("graphM").value) || 0;
  const b = parseFloat(document.getElementById("graphB").value) || 0;
  const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2, scale = 15;

  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += scale) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y <= h; y += scale) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();

  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 2.5;
    ctx.beginPath();
  const xMin = -cx / scale, xMax = cx / scale;
  ctx.moveTo(0, cy - (m * xMin + b) * scale);
  ctx.lineTo(w, cy - (m * xMax + b) * scale);
  ctx.stroke();
}

function openMathToolkitModal() {
  const box = document.getElementById("mathToolkitBox");
  if (!box) return;
  box.classList.remove("hidden");
  if (typeof drawBackpackLine === "function") drawBackpackLine();
  box.scrollIntoView({ behavior: "smooth", block: "center" });
}

window.addEventListener("DOMContentLoaded", async () => {
  try {
    const creds = JSON.parse(localStorage.getItem("gph_saved_creds") || "{}");
    const pe = document.getElementById("parentEmail");
    const sc = document.getElementById("stuInviteCode");
    const su = document.getElementById("stuUsername");
    if (pe && creds.parentEmail) pe.value = creds.parentEmail;
    if (sc && creds.stuInviteCode) sc.value = creds.stuInviteCode;
    if (su && creds.stuUsername) su.value = creds.stuUsername;

    const rawSess = localStorage.getItem("gph_session") || sessionStorage.getItem("gph_session");
    if (rawSess) {
      const sess = JSON.parse(rawSess);
      if (sess && sess.currentFamily && sess.currentUser) {
        authToken = sess.authToken || null;
        currentFamily = sess.currentFamily;
        currentUser = sess.currentUser;
        if (sess.role === "parent") {
          await loadParentDashboard();
        } else if (sess.role === "student") {
          await loadStudentDashboard();
        }
      }
    }
  } catch (e) {}
});
