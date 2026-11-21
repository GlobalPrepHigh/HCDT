const SUPABASE_URL = "https://cnjgoixunkygvwbuifiy.supabase.co";
const SUPABASE_KEY = "sb_publishable_llm2wWoQpOl3oj1xJFkRfA_Fd69Aj8J";

let authToken = null;
let isSignupMode = false;
let currentFamily = null;
let currentUser = null;
let studentsCache = [];
let assignmentsCache = [];
let submissionsCache = [];
let achievementsCache = [];

// Direct Supabase REST & Auth Helper (Zero external CDN needed)
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
  if (single && Array.isArray(data)) return data[0] || null;
  return data;
}


// --- AUTH UI ---
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

// --- PARENT LOGIN / SIGNUP ---
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

// --- STUDENT PIN LOGIN ---
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

function renderStudents() {
  const list = document.getElementById("studentList");
  const selects = ["assignStudentSelect", "achStudentSelect", "transStudentSelect"];
  list.innerHTML = studentsCache.map(s => `
    <div class="item-card">
      <strong>${s.full_name}</strong> (${s.grade_level} Grade • Class of ${s.expected_grad_year})<br>
      <small class="muted">Student Login: Username <b>${s.username}</b> | PIN <b>${s.pin}</b></small>
    </div>
  `).join("") || "<p class='muted'>No students added yet.</p>";

    const options = studentsCache.map(s => `<option value="${s.id}">${s.full_name} (${s.grade_level})</option>`).join("");
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

async function createAssignment() {
  const student_id = document.getElementById("assignStudentSelect").value;
  const subject = document.getElementById("assignSubject").value.trim();
  const course_level = document.getElementById("assignLevel").value;
  const quarter = document.getElementById("assignQuarter").value;
  const credits = parseFloat(document.getElementById("assignCredits").value);
  const due_date = document.getElementById("assignDueDate").value || null;
  const grading_scale = document.getElementById("assignGradingScale").value.trim();
  const title = document.getElementById("assignTitle").value.trim();
  const resource_url = document.getElementById("assignResourceUrl").value.trim();
  const description = document.getElementById("assignDesc").value.trim();
  const answer_key = document.getElementById("assignAnswerKey").value.trim();
  const travel_location = document.getElementById("assignLocation").value.trim();

  if (!student_id || !subject || !title) return alert("Select a student and enter Course/Subject and Title.");

  try {
    await sbQuery("assignments", {
      method: "POST",
      body: { family_id: currentFamily.id, student_id, subject, course_level, quarter, credits, due_date, grading_scale, title, resource_url, description, answer_key, travel_location }
    });
    ["assignTitle", "assignResourceUrl", "assignDesc", "assignAnswerKey", "assignLocation"].forEach(id => (document.getElementById(id).value = ""));
    await refreshFamilyData();
    alert("Course module posted to student portal!");
  } catch (err) {
    alert(err.message);
  }
}

function renderGradingQueue() {
  const container = document.getElementById("parentAssignmentList");
  if (!assignmentsCache.length) {
    container.innerHTML = "<p class='muted'>No coursework posted yet.</p>";
    return;
  }
  container.innerHTML = assignmentsCache.map(a => {
    const stu = studentsCache.find(s => s.id === a.student_id);
    const sub = submissionsCache.find(s => s.assignment_id === a.id);
    const gradeVal = sub && sub.grade ? sub.grade : "";
    const fbVal = sub && sub.parent_feedback ? sub.parent_feedback : "";
    const dueText = a.due_date ? " • Due: <b>" + a.due_date + "</b>" : "";
    const keyBox = a.answer_key ? '<div style="background:#fef9c3; padding:8px; border-radius:6px; margin-top:6px;"><small><b>🔒 Parent Answer Key:</b> ' + a.answer_key + '</small></div>' : "";
    const subWork = sub && (sub.student_notes || sub.submission_link)
      ? '<div style="background:#f1f5f9; padding:8px; border-radius:6px; margin-top:6px;"><small><b>Student Work:</b> ' + (sub.student_notes || "") + (sub.submission_link ? ' <a href="' + sub.submission_link + '" target="_blank">[Open Attached Work/Math Link]</a>' : '') + '</small></div>'
      : '<small class="muted">Awaiting student submission</small>';

    return '<div class="item-card"><strong>' + a.subject + ': ' + a.title + '</strong> (' + a.course_level + ' • ' + a.credits + ' cr • ' + a.quarter + ')<br><small class="muted">Student: ' + (stu ? stu.full_name : "Student") + dueText + '</small>' + keyBox + subWork + '<div class="row-2" style="margin-top:8px;"><input type="text" id="grade-' + a.id + '" placeholder="Grade (A, 96%, etc.)" value="' + gradeVal + '" /><input type="text" id="fb-' + a.id + '" placeholder="Professor Feedback..." value="' + fbVal + '" /></div><button class="btn-outline" style="margin-top:6px;" onclick="saveGrade(\'' + a.id + '\', \'' + a.student_id + '\')">Save Grade & Feedback</button></div>';
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

  const courseMap = {};
  stuAssigns.forEach(a => {
    const key = `${a.quarter}||${a.subject}||${a.course_level}`;
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
  let totalPoints = 0;

  const rows = Object.values(courseMap).map(c => {
    let gradeDisplay = "In Progress";
    if (c.scores.length > 0) {
      const avgPct = c.scores.reduce((sum, v) => sum + v, 0) / c.scores.length;
      const { letter, pts } = percentToLetterAndPoints(avgPct);
      const boost = c.course_level.includes("AP") ? 1.0 : c.course_level.includes("Honors") ? 0.5 : 0;
      totalCredits += c.credits;
      totalPoints += (pts + boost) * c.credits;
      gradeDisplay = `${letter} (${avgPct.toFixed(0)}%)`;
    }
    return `<tr><td>${c.quarter}</td><td>${c.subject}</td><td>${c.course_level}</td><td>${c.credits.toFixed(1)}</td><td><strong>${gradeDisplay}</strong></td></tr>`;
  }).join("");

  const gpa = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : "N/A";
  const achSection = stuAchs.length ? `<h4 style="margin-top:16px;">Worldschooling Field Studies, Certifications & Service</h4><ul>${stuAchs.map(x => `<li><strong>${x.type}:</strong> ${x.title}${x.location ? ` (${x.location})` : ""}${x.metric ? ` — ${x.metric}` : ""}</li>`).join("")}</ul>` : "";

  preview.innerHTML = `<div style="border:2px solid #1e293b; padding:24px; border-radius:8px; margin-bottom:24px;"><h2 style="text-align:center; margin-bottom:4px;">${currentFamily.family_name.toUpperCase()}</h2><p style="text-align:center; margin-top:0;"><strong>OFFICIAL HIGH SCHOOL ACADEMIC TRANSCRIPT</strong></p><hr><p><strong>Student Legal Name:</strong> ${stu.full_name} &nbsp;|&nbsp; <strong>Grade:</strong> ${stu.grade_level} &nbsp;|&nbsp; <strong>Expected Graduation:</strong> ${stu.expected_grad_year}</p><p><strong>Cumulative Weighted GPA:</strong> ${gpa} &nbsp;|&nbsp; <strong>Total Credits Earned:</strong> ${totalCredits.toFixed(1)}</p><table style="width:100%; border-collapse:collapse; margin-top:12px;" border="1" cellpadding="6"><thead><tr><th>Term</th><th>Course</th><th>Level</th><th>Credits</th><th>Quarter Grade</th></tr></thead><tbody>${rows || "<tr><td colspan='5'>No courses recorded yet.</td></tr>"}</tbody></table>${achSection}<p style="margin-top:24px;">Administrator Signature: ___________________________ &nbsp;&nbsp; Date: _______________</p></div><div style="border:4px double #1e293b; padding:32px; text-align:center; border-radius:8px;"><h1 style="margin-bottom:8px;">${currentFamily.family_name}</h1><p><em>Be it known that</em></p><h2>${stu.full_name}</h2><p>has satisfactorily completed the High School Course of Study prescribed for graduation and is hereby awarded this</p><h3>HIGH SCHOOL DIPLOMA</h3><p>Class of ${stu.expected_grad_year}</p><p style="margin-top:28px;">___________________________<br><small>Head of School / Parent Administrator</small></p></div>`;
}


async function loadStudentDashboard() {

  saveSession("student");

  document.getElementById("authSection").classList.add("hidden");
  document.getElementById("studentDashboard").classList.remove("hidden");
  document.getElementById("logoutBtn").classList.remove("hidden");

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
    const noteVal = sub && sub.student_notes ? sub.student_notes : "";
    return '<div class="item-card"><strong>' + a.subject + ': ' + a.title + '</strong> (' + a.quarter + ' • ' + a.credits + ' cr)<br><p><small>' + (a.description || "") + '</small></p><small>Status: <b>' + statusText + '</b></small><div class="row-2" style="margin-top:8px;"><input type="text" id="subnote-' + a.id + '" placeholder="Add completion note or link..." value="' + noteVal + '" /><button class="btn-primary" onclick="submitWork(\'' + a.id + '\')">Mark Complete</button></div></div>';
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


