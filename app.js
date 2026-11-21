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
  errEl.innerText = "";
  const email = document.getElementById("parentEmail").value.trim();
  const password = document.getElementById("parentPassword").value;

  if (!email || !password) return (errEl.innerText = "Please enter email and password.");

  try {
    btn.disabled = true;
    btn.innerText = "Connecting...";

    if (isSignupMode) {
      const fullName = document.getElementById("parentName").value.trim();
      const academyName = document.getElementById("academyName").value.trim();
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
        body: { id: userObj.id, family_id: famData.id, full_name: fullName, role: "parent" },
        single: true
      });

      currentFamily = famData;
      currentUser = profData;
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
      currentFamily = famData;
      await loadParentDashboard();
    }
  } catch (err) {
    errEl.innerText = err.message;
  } finally {
    btn.disabled = false;
    btn.innerText = isSignupMode ? "Create Academy & Sign In" : "Sign In";
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
  localStorage.setItem("gph_session", JSON.stringify({
    role,
    authToken,
    currentFamily,
    currentUser
  }));
}

function logout() {
  localStorage.removeItem("gph_session");
  location.reload();
}

async function loadParentDashboard() {
  saveSession("parent");
  document.getElementById("authSection").classList.add("hidden");
  document.getElementById("parentDashboard").classList.remove("hidden");
  document.getElementById("logoutBtn").classList.remove("hidden");

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
  list.innerHTML = studentsCache.map(s => '<div class="item-card" style="display:flex; justify-content:space-between; align-items:center; gap:10px;"><div><strong>' + s.full_name + '</strong> (' + s.grade_level + ' Grade • Class of ' + s.expected_grad_year + ')<br><small class="muted">Student Login: Username <b>' + s.username + '</b> | PIN <b>' + s.pin + '</b></small></div><button class="btn-outline" style="width:auto; white-space:nowrap; color:#1e293b;" onclick="previewStudentPortal(\'' + s.id + '\')">👀 Preview Portal</button></div>').join("") || "<p class='muted'>No students added yet.</p>";

  const options = studentsCache.map(s => '<option value="' + s.id + '">' + s.full_name + ' (' + s.grade_level + ')</option>').join("");
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = options;
  });
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
  const sel = document.getElementById("curriculumSelect");
  if (!sel || typeof HONORS_CURRICULUM === "undefined") return;
  sel.innerHTML = HONORS_CURRICULUM.map(m => '<option value="' + m.id + '">' + m.subject + ' — ' + m.title + '</option>').join("");
}

async function assignHonorsModule() {
  const student_id = document.getElementById("assignStudentSelect").value;
  const modId = document.getElementById("curriculumSelect").value;
  const due_date = document.getElementById("assignDueDate").value || null;
  const quarter = document.getElementById("assignQuarter").value;
  const travel_location = document.getElementById("assignLocation").value.trim();

  if (!student_id) return alert("Please add/select a student first.");
  const mod = HONORS_CURRICULUM.find(m => m.id === modId);
  if (!mod) return alert("Select a curriculum module.");

  try {
    await sbQuery("assignments", {
      method: "POST",
      body: {
        family_id: currentFamily.id,
        student_id,
        subject: mod.subject,
        course_level: mod.course_level,
        quarter,
        credits: mod.credits,
        due_date,
        grading_scale: mod.grading_scale,
        title: '[' + mod.id + '] ' + mod.title,
        resource_url: mod.resource_url,
        description: mod.description,
        answer_key: mod.answer_key,
        travel_location
      }
    });
    document.getElementById("assignLocation").value = "";
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

function renderGradingQueue() {
  const container = document.getElementById("parentAssignmentList");
  if (!assignmentsCache.length) {
    container.innerHTML = "<p class='muted'>No modules assigned yet. Pick a U.S. Honors module on the left to begin!</p>";
    return;
  }
  container.innerHTML = assignmentsCache.map(a => {
    const stu = studentsCache.find(s => s.id === a.student_id);
    const sub = submissionsCache.find(s => s.assignment_id === a.id);
    const gradeVal = sub && sub.grade ? sub.grade : "";
    const fbVal = sub && sub.parent_feedback ? sub.parent_feedback : "";
    const dueText = a.due_date ? " • Due: <b>" + a.due_date + "</b>" : "";
    const cleanTitle = a.title.replace(/^\[[^\]]+\]\s*/, "");
    const keyBox = a.answer_key ? '<div style="background:#fef9c3; padding:8px; border-radius:6px; margin-top:6px;"><small><b>🔒 Parent Answer Key:</b><br>' + a.answer_key.replace(/\n/g, "<br>") + '</small></div>' : "";
    const subWork = sub && (sub.student_notes || sub.submission_link)
      ? '<div style="background:#f1f5f9; padding:8px; border-radius:6px; margin-top:6px;"><small><b>Student Work:</b> ' + (sub.student_notes || "") + (sub.submission_link ? ' <a href="' + sub.submission_link + '" target="_blank">[Open Attached Link]</a>' : '') + '</small></div>'
      : '<small class="muted">Awaiting student submission</small>';

    return '<div class="item-card"><div style="display:flex; justify-content:space-between; align-items:start;"><div><strong>' + a.subject + ': ' + cleanTitle + '</strong> (' + a.course_level + ' • ' + a.quarter + ')<br><small class="muted">Student: ' + (stu ? stu.full_name : "Student") + dueText + '</small></div><button class="btn-outline" style="padding:4px 8px; font-size:12px;" onclick="deleteAssignment(\'' + a.id + '\')">🗑️ Remove</button></div>' + keyBox + subWork + '<div class="row-2" style="margin-top:8px;"><input type="text" id="grade-' + a.id + '" placeholder="Grade (A, 96%, etc.)" value="' + gradeVal + '" /><input type="text" id="fb-' + a.id + '" placeholder="Professor Feedback..." value="' + fbVal + '" /></div><button class="btn-outline" style="margin-top:6px;" onclick="saveGrade(\'' + a.id + '\', \'' + a.student_id + '\')">Save Grade & Feedback</button></div>';
  }).join("");
}

async function saveGrade(assignment_id, student_id) {
  const grade = document.getElementById("grade-" + assignment_id).value.trim().toUpperCase();
  const parent_feedback = document.getElementById("fb-" + assignment_id).value.trim();
  if (!grade) return alert("Enter a grade first.");
  try {
    const existing = submissionsCache.find(s => s.assignment_id === assignment_id);
    if (existing) {
      await sbQuery("submissions", {
        method: "PATCH",
        query: `id=eq.${existing.id}`,
        body: { grade, parent_feedback, status: "Graded" }
      });
    } else {
      await sbQuery("submissions", {
        method: "POST",
        body: { assignment_id, student_id, grade, parent_feedback, status: "Graded" }
      });
    }
    await refreshFamilyData();
    alert("Grade & feedback saved!");
  } catch (err) {
    alert(err.message);
  }
}

async function addAchievement() {
  const student_id = document.getElementById("achStudentSelect").value;
  const type = document.getElementById("achType").value;
  const title = document.getElementById("achTitle").value.trim();
  const location = document.getElementById("achLocation").value.trim();
  const metric = document.getElementById("achMetric").value.trim();

  if (!student_id || !title) return alert("Select a student and enter a title.");

  try {
    await sbQuery("achievements", {
      method: "POST",
      body: {
        family_id: currentFamily.id,
        student_id,
        type,
        title,
        location,
        metric,
        date_completed: new Date().toISOString().split("T")[0]
      }
    });
    document.getElementById("achTitle").value = "";
    document.getElementById("achLocation").value = "";
    document.getElementById("achMetric").value = "";
    await refreshFamilyData();
  } catch (err) {
    alert(err.message);
  }
}

function renderAchievements() {
  const container = document.getElementById("parentAchievementList");
  container.innerHTML = achievementsCache.map(ac => {
    const stu = studentsCache.find(s => s.id === ac.student_id);
    const loc = ac.location ? " • 📍 " + ac.location : "";
    const met = ac.metric ? " • " + ac.metric : "";
    return '<div class="item-card"><strong>[' + ac.type + '] ' + ac.title + '</strong><br><small class="muted">' + (stu ? stu.full_name : "") + loc + met + '</small></div>';
  }).join("") || "<p class='muted'>No travel study, certifications, or service logged yet.</p>";
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
  if (pct >= 60) return { letter: "D", pts: 1.0 };
  return { letter: "F", pts: 0.0 };
}

function renderOfficialRecords() {
  const stuId = document.getElementById("transStudentSelect").value;
  const stu = studentsCache.find(s => s.id === stuId);
  const preview = document.getElementById("officialDocsPreview");
  if (!stu) {
    preview.innerHTML = "<p class='muted'>Add a student first to generate their Transcript & Diploma.</p>";
    return;
  }

  const stuAssigns = assignmentsCache.filter(a => a.student_id === stu.id);
  const stuAchs = achievementsCache.filter(a => a.student_id === stu.id);
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
    const sub = submissionsCache.find(s => s.assignment_id === a.id);
    const pct = sub && sub.grade ? parseGradePercent(sub.grade) : null;
    if (pct !== null) courseMap[key].scores.push(pct);
  });

  let totalCredits = 0;
  let weightedPoints = 0;
  let unweightedPoints = 0;

  const rows = Object.values(courseMap).map(c => {
    let gradeDisplay = "In Progress";
    let crEarned = "—";
    if (c.scores.length > 0) {
      const avgPct = c.scores.reduce((sum, v) => sum + v, 0) / c.scores.length;
      const { letter, pts } = percentToLetterAndPoints(avgPct);
      const boost = c.course_level.includes("AP") ? 1.0 : c.course_level.includes("Honors") ? 0.5 : 0;
      totalCredits += c.credits;
      unweightedPoints += pts * c.credits;
      weightedPoints += (pts + boost) * c.credits;
      gradeDisplay = letter + " (" + avgPct.toFixed(0) + "%)";
      crEarned = c.credits.toFixed(2);
    }
    return '<tr><td style="padding:8px 10px; border-bottom:1px solid #cbd5e1;">' + c.quarter + '</td><td style="padding:8px 10px; border-bottom:1px solid #cbd5e1; font-weight:600;">' + c.subject + '</td><td style="padding:8px 10px; border-bottom:1px solid #cbd5e1;">' + c.course_level + '</td><td style="padding:8px 10px; border-bottom:1px solid #cbd5e1; text-align:center;">' + c.credits.toFixed(2) + '</td><td style="padding:8px 10px; border-bottom:1px solid #cbd5e1; text-align:center;">' + crEarned + '</td><td style="padding:8px 10px; border-bottom:1px solid #cbd5e1; text-align:center; font-weight:700;">' + gradeDisplay + '</td></tr>';
  }).join("");

  const weightedGpa = totalCredits > 0 ? (weightedPoints / totalCredits).toFixed(2) : "N/A";
  const unweightedGpa = totalCredits > 0 ? (unweightedPoints / totalCredits).toFixed(2) : "N/A";

  const achSection = stuAchs.length
    ? '<div style="margin-top:18px; border-top:1px solid #94a3b8; padding-top:12px;"><div style="font-size:12px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#1e293b; margin-bottom:6px;">Honors Enrichment, Field Studies &amp; Certifications</div><ul style="margin:0; padding-left:20px; font-size:13px; line-height:1.6;">' + stuAchs.map(x => '<li><strong>' + x.type + ':</strong> ' + x.title + (x.location ? ' — <em>' + x.location + '</em>' : '') + (x.metric ? ' (' + x.metric + ')' : '') + '</li>').join("") + '</ul></div>'
    : "";

  const transcriptHtml =
    '<div style="font-family: Georgia, \'Times New Roman\', serif; color:#0f172a; background:#ffffff; border:2px solid #0f172a; padding:32px; border-radius:4px; margin-bottom:32px; box-shadow:0 2px 8px rgba(0,0,0,0.06);">' +
      '<div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px double #0f172a; padding-bottom:14px; margin-bottom:18px;">' +
        '<div>' +
          '<div style="font-size:22px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase;">' + currentFamily.family_name + '</div>' +
          '<div style="font-size:12px; letter-spacing:1px; text-transform:uppercase; color:#334155; margin-top:2px;">Office of the Registrar &bull; Official High School Academic Transcript</div>' +
        '</div>' +
        '<div style="border:1.5px solid #0f172a; padding:6px 12px; text-align:center; font-size:11px; letter-spacing:0.8px; text-transform:uppercase;">' +
          '<strong>Official Record</strong><br>Issued: ' + todayStr +
        '</div>' +
      '</div>' +

      '<table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:18px; background:#f8fafc; border:1px solid #cbd5e1;">' +
        '<tr>' +
          '<td style="padding:8px 12px; border-right:1px solid #cbd5e1;"><strong>Student Legal Name:</strong> ' + stu.full_name + '</td>' +
          '<td style="padding:8px 12px; border-right:1px solid #cbd5e1;"><strong>Grade Level:</strong> ' + stu.grade_level + '</td>' +
          '<td style="padding:8px 12px;"><strong>Expected Graduation:</strong> Class of ' + stu.expected_grad_year + '</td>' +
        '</tr>' +
        '<tr style="border-top:1px solid #cbd5e1;">' +
          '<td style="padding:8px 12px; border-right:1px solid #cbd5e1;"><strong>Weighted Cumulative GPA:</strong> ' + weightedGpa + '</td>' +
          '<td style="padding:8px 12px; border-right:1px solid #cbd5e1;"><strong>Unweighted GPA:</strong> ' + unweightedGpa + '</td>' +
          '<td style="padding:8px 12px;"><strong>Total Credits Earned:</strong> ' + totalCredits.toFixed(2) + '</td>' +
        '</tr>' +
      '</table>' +

      '<table style="width:100%; border-collapse:collapse; font-size:13px; border:1px solid #94a3b8;">' +
        '<thead>' +
          '<tr style="background:#1e293b; color:#ffffff; text-transform:uppercase; font-size:11px; letter-spacing:0.8px;">' +
            '<th style="padding:9px 10px; text-align:left;">Term</th>' +
            '<th style="padding:9px 10px; text-align:left;">Course Title</th>' +
            '<th style="padding:9px 10px; text-align:left;">Course Level</th>' +
            '<th style="padding:9px 10px; text-align:center;">Attempted</th>' +
            '<th style="padding:9px 10px; text-align:center;">Earned</th>' +
            '<th style="padding:9px 10px; text-align:center;">Final Grade</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' +
          (rows || '<tr><td colspan="6" style="padding:14px; text-align:center; color:#64748b;">No coursework recorded yet.</td></tr>') +
        '</tbody>' +
      '</table>' +

      achSection +

      '<div style="margin-top:16px; padding:8px 12px; background:#f8fafc; border:1px solid #cbd5e1; font-size:11px; color:#334155;">' +
        '<strong>Grading &amp; Weighting Scale:</strong> A (90–100) = 4.0 &bull; B (80–89) = 3.0 &bull; C (70–79) = 2.0 &bull; D (60–69) = 1.0 &bull; F (&lt;60) = 0.0. Honors courses receive +0.50 quality-point weight; AP courses receive +1.00 quality-point weight. 1.00 Carnegie Unit = 120–150 instructional hours.' +
      '</div>' +

      '<div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:32px; font-size:13px;">' +
        '<div>_________________________________________<br><span style="font-size:11px; text-transform:uppercase; letter-spacing:0.8px; color:#334155;">Signature of Registrar / Principal Administrator</span></div>' +
        '<div>______________________<br><span style="font-size:11px; text-transform:uppercase; letter-spacing:0.8px; color:#334155;">Date Certified</span></div>' +
      '</div>' +
    '</div>';

      const diplomaHtml =
    '<div style="font-family: Georgia, \'Times New Roman\', serif; color:#0f172a; background:#fffdf9; border:6px double #1e293b; padding:40px 32px; text-align:center; border-radius:4px; box-shadow:0 2px 10px rgba(0,0,0,0.06);">' +
      '<div style="border:1px solid #94a3b8; padding:28px 24px;">' +
        '<div style="font-size:12px; letter-spacing:2.5px; text-transform:uppercase; color:#475569; margin-bottom:6px;">In Recognition of Academic Achievement</div>' +
        '<div style="font-size:26px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#0f172a;">' + currentFamily.family_name + '</div>' +
        '<div style="width:120px; height:2px; background:#b45309; margin:14px auto;"></div>' +
        '<p style="font-size:15px; font-style:italic; color:#334155; margin:12px 0;">This certifies that</p>' +
        '<div style="font-size:28px; font-weight:700; letter-spacing:1px; color:#0f172a; margin:8px 0 14px 0;">' + stu.full_name + '</div>' +
        '<p style="font-size:14px; line-height:1.7; max-width:540px; margin:0 auto; color:#1e293b;">has satisfactorily completed the prescribed Course of Study required for Secondary Graduation and is hereby awarded this</p>' +
        '<div style="font-size:22px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:#1e293b; margin:18px 0 6px 0;">High School Diploma</div>' +
        '<div style="font-size:14px; letter-spacing:1px; color:#334155;">Class of ' + stu.expected_grad_year + ' &bull; Conferred ' + todayStr + '</div>' +
        '<div style="display:flex; justify-content:space-around; align-items:flex-end; margin-top:44px; gap:24px;">' +
          '<div style="font-size:12px;">______________________________<br><span style="font-size:11px; text-transform:uppercase; letter-spacing:0.8px; color:#475569;">Head of School / Administrator</span></div>' +
          '<div style="font-size:12px;">______________________________<br><span style="font-size:11px; text-transform:uppercase; letter-spacing:0.8px; color:#475569;">Academic Registrar</span></div>' +
        '</div>' +
      '</div>' +
    '</div>';

  preview.innerHTML = transcriptHtml + diplomaHtml;
  {

function getYouTubeEmbed(url) {
  const base = ["https://www.", "youtube-nocookie.com", "/embed/"].join("");
  if (url.startsWith("yt:")) return base + url.slice(3).trim();
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([A-Za-z0-9_-]{11})/);
  return m ? base + m.at(1) : null;
}

function toggleMissionStep(assignId, stepIdx) {
  const key = "gph_steps_" + assignId;
  const saved = JSON.parse(localStorage.getItem(key) || "{}");
  saved[stepIdx] = !saved[stepIdx];
  localStorage.setItem(key, JSON.stringify(saved));
  const boxes = document.querySelectorAll(".step-cb-" + assignId);
  const checked = Array.from(boxes).filter(b => b.checked).length;
  const pct = Math.round((checked / boxes.length) * 100);
  const bar = document.getElementById("prog-bar-" + assignId);
  const lbl = document.getElementById("prog-lbl-" + assignId);
  if (bar) bar.style.width = pct + "%";
  if (lbl) lbl.innerText = pct === 100 ? "100% Complete! Ready to Submit 🏆" : pct + "% Mission Progress";
}

function checkQuizAnswer(assignId, qIdx, chosenIdx, correctIdx) {
  const resEl = document.getElementById("quiz-res-" + assignId + "-" + qIdx);
  if (!resEl) return;
  if (chosenIdx === correctIdx) {
    resEl.innerHTML = "<span style='color:#15803d; font-weight:600;'>✅ Spot on! +10 Honors XP</span>";
  } else {
    resEl.innerHTML = "<span style='color:#b91c1c; font-weight:600;'>❌ Not quite — rewatch/reread and try again!</span>";
  }
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
      banner.style.cssText = "background:#fef08a; border:1px solid #eab308; padding:10px 14px; border-radius:8px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center;";
      banner.innerHTML = '<span><b>👀 Parent Preview Mode</b> — Viewing as ' + currentUser.full_name + '</span><button class="btn-primary" style="width:auto; padding:6px 12px;" onclick="exitStudentPreview()">⬅️ Back to Parent Dashboard</button>';
      document.getElementById("studentDashboard").prepend(banner);
    }
  } else if (banner) {
    banner.remove();
  }


  document.getElementById("stuDashWelcome").innerText = "Welcome, " + currentUser.full_name;
  document.getElementById("stuDashMeta").innerText = currentFamily.family_name + " • " + currentUser.grade_level + " Grade • Class of " + currentUser.expected_grad_year;

  const assigns = (await sbQuery("assignments", {
    query: `student_id=eq.${currentUser.id}&select=*&order=created_at.desc`
  })) || [];
  const subs = (await sbQuery("submissions", {
    query: `student_id=eq.${currentUser.id}&select=*`
  })) || [];
  const achs = (await sbQuery("achievements", {
    query: `student_id=eq.${currentUser.id}&select=*`
  })) || [];

  document.getElementById("studentAssignmentList").innerHTML = assigns.map(a => {
    const sub = subs.find(s => s.assignment_id === a.id);
    const statusText = sub && sub.grade ? "Graded: " + sub.grade : sub ? "Submitted" : "Assigned";
    const dueBadge = a.due_date ? " • 📅 Due: <b>" + a.due_date + "</b>" : "";
    const scaleHtml = a.grading_scale ? '<br><small><b>Grading Rubric:</b> ' + a.grading_scale + '</small>' : "";
    const codeMatch = a.title.match(/^\[([^\]]+)\]\s*(.*)$/);
    const modCode = codeMatch ? codeMatch[1] : null;
    const cleanTitle = codeMatch ? codeMatch[2] : a.title;
    const currMod = (typeof HONORS_CURRICULUM !== "undefined" && modCode) ? HONORS_CURRICULUM.find(m => m.id === modCode) : null;
    const links = a.resource_url ? a.resource_url.split(/\r?\n/).map(u => u.trim()).filter(Boolean) : [];

            const mediaHtml = links.map((url, idx) => {
      const yt = getYouTubeEmbed(url);
      if (yt) {
        return '<div style="margin:10px 0;"><small><b>🎬 Video Lesson ' + (idx + 1) + '</b></small><div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:8px; margin-top:4px; background:#0f172a;"><iframe src="' + yt + '" style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div></div>';
      }
      const cleanHref = url.startsWith("pdf:") ? url.slice(4).trim() : url;
      return '<div style="margin:8px 0;"><a href="' + cleanHref + '" target="_blank" class="btn-outline" style="display:inline-block; text-decoration:none;">📖 Open Reading / PDF Book</a></div>';
    }).join("");

    const steps = ["Watch Video Lesson(s)", "Complete Reading & Real-World Activity", "Pass Interactive Quick Check", "Submit Written Reflection"];
    const savedSteps = JSON.parse(localStorage.getItem("gph_steps_" + a.id) || "{}");
    const doneCount = steps.filter((_, i) => savedSteps[i]).length;
    const pct = Math.round((doneCount / steps.length) * 100);
    const checklistHtml = '<div style="background:#f8fafc; border:1px solid #e2e8f0; padding:10px; border-radius:8px; margin:10px 0;"><div style="display:flex; justify-content:space-between; margin-bottom:4px;"><small><b id="prog-lbl-' + a.id + '">' + (pct === 100 ? "100% Complete! Ready to Submit 🏆" : pct + "% Mission Progress") + '</b></small></div><div style="background:#e2e8f0; height:8px; border-radius:99px; overflow:hidden; margin-bottom:8px;"><div id="prog-bar-' + a.id + '" style="background:#2563eb; width:' + pct + '%; height:100%; transition:width 0.3s;"></div></div>' + steps.map((st, i) => '<label style="display:flex; align-items:center; gap:8px; font-weight:normal; margin:4px 0; cursor:pointer;"><input type="checkbox" class="step-cb-' + a.id + '" style="width:auto; margin:0;" ' + (savedSteps[i] ? "checked" : "") + ' onchange="toggleMissionStep(\'' + a.id + '\', ' + i + ')" /> <span>' + st + '</span></label>').join("") + '</div>';

    const quizHtml = (currMod && currMod.quiz) ? '<div style="background:#eff6ff; border:1px solid #bfdbfe; padding:10px; border-radius:8px; margin:10px 0;"><small><b>⚡ Interactive Quick Check (Test Your Knowledge!)</b></small>' + currMod.quiz.map((qObj, qi) => '<div style="margin-top:8px;"><small><b>' + qObj.q + '</b></small><div style="display:flex; flex-direction:column; gap:4px; margin-top:4px;">' + qObj.options.map((opt, oi) => '<button type="button" class="btn-outline" style="text-align:left; font-size:12px; padding:6px 10px;" onclick="checkQuizAnswer(\'' + a.id + '\', ' + qi + ', ' + oi + ', ' + qObj.answer + ')">' + opt + '</button>').join("") + '</div><div id="quiz-res-' + a.id + '-' + qi + '" style="margin-top:4px; font-size:12px;"></div></div>').join("") + '</div>' : "";

    const fbHtml = sub && sub.parent_feedback ? '<div style="background:#ecfdf5; padding:6px; border-radius:6px; margin-top:6px;"><small><b>Instructor Feedback:</b> ' + sub.parent_feedback + '</small></div>' : "";

    return '<div class="item-card"><strong>' + a.subject + ' (' + a.course_level + '): ' + cleanTitle + '</strong><br><small class="muted">' + a.quarter + ' • ' + a.credits + ' cr' + dueBadge + '</small>' + scaleHtml + mediaHtml + '<p style="margin:8px 0;"><small>' + (a.description || "").replace(/\n/g, "<br>") + '</small></p>' + checklistHtml + quizHtml + '<small>Status: <b>' + statusText + '</b></small>' + fbHtml + '<div style="margin-top:8px;"><textarea id="subnote-' + a.id + '" rows="3" placeholder="Type your reflection, math solutions, or lab observations...">' + (sub && sub.student_notes ? sub.student_notes : "") + '</textarea><input type="url" id="sublink-' + a.id + '" placeholder="Paste Google Drive / Photo / Video link (optional)..." value="' + (sub && sub.submission_link ? sub.submission_link : "") + '" style="margin-top:6px;" /><button class="btn-primary" style="margin-top:6px;" onclick="submitWork(\'' + a.id + '\')">Submit Assignment</button></div></div>';
  }).join("") || "<p class='muted'>No assignments posted yet.</p>";

  document.getElementById("studentPortfolioList").innerHTML = achs.map(ac => {
    const met = ac.metric ? " • " + ac.metric : "";
    return '<div class="item-card"><strong>[' + ac.type + '] ' + ac.title + '</strong><br><small class="muted">' + (ac.location || "") + met + '</small></div>';
  }).join("") || "<p class='muted'>No travel study or certifications logged yet.</p>";
}

async function submitWork(assignment_id) {
  const notes = document.getElementById("subnote-" + assignment_id).value.trim();
  const linkEl = document.getElementById("sublink-" + assignment_id);
  const link = linkEl ? linkEl.value.trim() : "";
  try {
    const existing = await sbQuery("submissions", {
      query: `assignment_id=eq.${assignment_id}&student_id=eq.${currentUser.id}&select=*`,
      single: true
    });
    if (existing) {
      await sbQuery("submissions", {
        method: "PATCH",
        query: `id=eq.${existing.id}`,
        body: { student_notes: notes, submission_link: link, status: "Submitted" }
      });
    } else {
      await sbQuery("submissions", {
        method: "POST",
        body: { assignment_id, student_id: currentUser.id, student_notes: notes, submission_link: link, status: "Submitted" }
      });
    }
    alert("Work submitted to your instructor!");
    await loadStudentDashboard();
  } catch (err) {
    alert(err.message);
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  const saved = localStorage.getItem("gph_session");
  if (!saved) return;
  try {
    const session = JSON.parse(saved);
    authToken = session.authToken || null;
    currentFamily = session.currentFamily;
    currentUser = session.currentUser;
    if (session.role === "parent" && currentFamily && currentUser) {
      await loadParentDashboard();
    } else if (session.role === "student" && currentFamily && currentUser) {
      await loadStudentDashboard();
    }
  } catch (e) {
    localStorage.removeItem("gph_session");
  }
});

