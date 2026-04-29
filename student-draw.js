(function () {
  "use strict";

  var REQUIRED_FIELDS = ["序號", "班級", "學號", "姓名"];
  var EXCLUDED_STATUS = "作業未交";
  var config = window.STUDENT_DRAW_CONFIG || {};
  var state = {
    students: [],
    drawnIds: [],
    currentStudentId: null,
    nextStudentId: null,
    initialized: false,
    error: "",
  };

  var elements = {
    title: document.getElementById("courseTitle"),
    totalCount: document.getElementById("totalCount"),
    drawnCount: document.getElementById("drawnCount"),
    remainingCount: document.getElementById("remainingCount"),
    sessionState: document.getElementById("sessionState"),
    currentStudent: document.getElementById("currentStudent"),
    nextStudent: document.getElementById("nextStudent"),
    drawButton: document.getElementById("drawButton"),
    resetButton: document.getElementById("resetButton"),
    fullscreenButton: document.getElementById("fullscreenButton"),
    tableBody: document.getElementById("studentTableBody"),
    errorBanner: document.getElementById("errorBanner"),
  };

  function init() {
    bindEvents();
    applyConfig();
    loadStudents();
  }

  function bindEvents() {
    elements.drawButton.addEventListener("click", handleDraw);
    elements.resetButton.addEventListener("click", resetDrawState);
    elements.fullscreenButton.addEventListener("click", toggleFullscreen);
    elements.tableBody.addEventListener("click", handleTableClick);
    document.addEventListener("fullscreenchange", renderFullscreenButton);
  }

  function applyConfig() {
    if (config.COURSE_TITLE) {
      document.title = config.COURSE_TITLE;
      elements.title.textContent = config.COURSE_TITLE;
    }

    elements.drawnCount.textContent = "0";
    renderFullscreenButton();
  }

  async function loadStudents() {
    clearError();

    if (!config.STUDENT_LIST_URL) {
      setError("設定缺少 STUDENT_LIST_URL，無法載入學生名單。");
      disableDraw();
      return;
    }

    try {
      var response = await fetch(config.STUDENT_LIST_URL, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      var data = await response.json();
      validateStudents(data);
      state.students = data.slice();

      resetDrawState();
      state.initialized = true;
      render();
    } catch (error) {
      setError("學生名單載入失敗：" + error.message);
      disableDraw();
      render();
    }
  }

  function validateStudents(data) {
    if (!Array.isArray(data)) {
      throw new Error("學生名單 JSON 必須是陣列格式。");
    }

    data.forEach(function (student, index) {
      REQUIRED_FIELDS.forEach(function (field) {
        if (!(field in student)) {
          throw new Error("第 " + (index + 1) + " 筆資料缺少欄位：" + field);
        }
      });
    });
  }

  function resetDrawState() {
    state.drawnIds = [];
    state.currentStudentId = null;
    state.nextStudentId = null;
    clearError();
    render();
  }

  function handleDraw() {
    if (!state.initialized || state.error) {
      return;
    }

    var eligibleCount = getEligibleStudents().length;
    if (eligibleCount === 0) {
      render();
      return;
    }

    if (state.drawnIds.length >= eligibleCount && state.nextStudentId === null) {
      render();
      return;
    }

    if (state.drawnIds.length === 0) {
      var firstPair = drawUniqueStudents(Math.min(2, eligibleCount));
      state.currentStudentId = getStudentId(firstPair[0]);
      state.nextStudentId = firstPair[1] ? getStudentId(firstPair[1]) : null;
      state.drawnIds = firstPair.map(function (student) {
        return getStudentId(student);
      });
      render();
      return;
    }

    if (state.nextStudentId !== null) {
      state.currentStudentId = state.nextStudentId;
    }

    if (state.drawnIds.length < eligibleCount) {
      var newNext = drawUniqueStudents(1)[0];
      state.nextStudentId = getStudentId(newNext);
      state.drawnIds.push(state.nextStudentId);
    } else {
      state.nextStudentId = null;
    }

    render();
  }

  function drawUniqueStudents(count) {
    var available = getEligibleStudents().filter(function (student) {
      return state.drawnIds.indexOf(getStudentId(student)) === -1;
    });

    if (available.length < count) {
      throw new Error("剩餘可抽學生不足。");
    }

    var selected = [];
    for (var i = 0; i < count; i += 1) {
      var randomIndex = Math.floor(Math.random() * available.length);
      selected.push(available.splice(randomIndex, 1)[0]);
    }
    return selected;
  }

  function render() {
    elements.totalCount.textContent = state.students.length ? String(getEligibleStudents().length) : "--";
    elements.drawnCount.textContent = state.students.length ? String(state.drawnIds.length) : "0";
    elements.remainingCount.textContent = state.students.length ? String(getEligibleStudents().length - state.drawnIds.length) : "--";
    elements.currentStudent.innerHTML = getSpotlightMarkup(findStudent(state.currentStudentId), "尚未抽出");
    elements.nextStudent.innerHTML = getSpotlightMarkup(findStudent(state.nextStudentId), getNextFallbackText());
    renderSessionState();
    renderTable();
    renderBanner();
    updateButtonStates();
  }

  function renderSessionState() {
    if (state.error) {
      elements.sessionState.textContent = "設定錯誤";
      return;
    }

    if (state.drawnIds.length === 0) {
      elements.sessionState.textContent = canEditExclusions() ? "設定名單中" : "尚未開始";
      return;
    }

    if (state.drawnIds.length >= getEligibleStudents().length && state.nextStudentId === null) {
      elements.sessionState.textContent = "本輪抽籤完成";
      return;
    }

    elements.sessionState.textContent = "抽籤進行中";
  }

  function renderTable() {
    if (!state.students.length) {
      elements.tableBody.innerHTML = "";
      return;
    }

    elements.tableBody.innerHTML = state.students.map(function (student) {
      var status = getStudentStatus(student);
      return [
        '<tr class="' + status.rowClass + '">',
        '<td class="mono">' + escapeHtml(String(student["序號"])) + '</td>',
        '<td>' + escapeHtml(String(student["班級"])) + '</td>',
        '<td class="mono">' + escapeHtml(String(student["學號"])) + '</td>',
        '<td>' + escapeHtml(String(student["姓名"])) + '</td>',
        '<td>' + getStatusControlMarkup(student, status) + '</td>',
        '</tr>'
      ].join("");
    }).join("");
  }

  function getStatusControlMarkup(student, status) {
    if (!canEditExclusions()) {
      return '<span class="status-badge ' + status.badgeClass + '">' + status.label + '</span>';
    }

    return [
      '<button class="status-badge status-toggle ' + status.badgeClass + '" type="button" data-student-id="' + escapeHtml(getStudentId(student)) + '">',
      status.label,
      '</button>'
    ].join("");
  }

  function updateButtonStates() {
    var eligibleCount = getEligibleStudents().length;
    var hasNoEligibleStudents = state.initialized && eligibleCount === 0;
    var isFinished = state.drawnIds.length >= eligibleCount && state.nextStudentId === null;
    var shouldDisableDraw = !!state.error || !state.initialized || hasNoEligibleStudents || isFinished;
    elements.drawButton.disabled = shouldDisableDraw;
  }

  function handleTableClick(event) {
    var target = event.target;
    if (!target || !target.closest) {
      return;
    }

    var button = target.closest(".status-toggle");
    if (!button || !canEditExclusions()) {
      return;
    }

    toggleStudentExclusion(button.getAttribute("data-student-id"));
  }

  function toggleStudentExclusion(studentId) {
    var student = findStudent(studentId);
    if (!student) {
      return;
    }

    if (isStudentExcluded(student)) {
      delete student["狀態"];
    } else {
      student["狀態"] = EXCLUDED_STATUS;
    }

    render();
  }

  function disableDraw() {
    elements.drawButton.disabled = true;
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      setError("無法切換全螢幕模式：" + error.message);
    }
  }

  function renderFullscreenButton() {
    if (!elements.fullscreenButton) {
      return;
    }

    if (document.fullscreenElement) {
      elements.fullscreenButton.textContent = "結束全螢幕";
      elements.fullscreenButton.classList.add("is-active");
    } else {
      elements.fullscreenButton.textContent = "全螢幕投影";
      elements.fullscreenButton.classList.remove("is-active");
    }
  }

  function getSpotlightMarkup(student, fallbackText) {
    if (!student) {
      return '<p>' + escapeHtml(fallbackText) + '</p>';
    }

    return [
      '<div class="meta"><span class="meta-chip">班級 ' + escapeHtml(String(student["班級"])) + '</span><span class="meta-chip">序號 ' + escapeHtml(String(student["序號"])) + '</span></div>',
      '<div class="name">' + escapeHtml(String(student["姓名"])) + '</div>',
      '<div class="details">',
      '<div><span class="detail-label">班級</span>' + escapeHtml(String(student["班級"])) + '</div>',
      '<div><span class="detail-label">學號</span><span class="mono">' + escapeHtml(String(student["學號"])) + '</span></div>',
      '<div><span class="detail-label">姓名</span>' + escapeHtml(String(student["姓名"])) + '</div>',
      '</div>'
    ].join("");
  }

  function getNextFallbackText() {
    if (state.drawnIds.length >= getEligibleStudents().length && state.currentStudentId !== null) {
      return "已抽完";
    }
    return "尚未抽出";
  }

  function getStudentStatus(student) {
    var studentId = getStudentId(student);
    if (isStudentExcluded(student)) {
      return { label: EXCLUDED_STATUS, badgeClass: "status-excluded", rowClass: "row-excluded" };
    }
    if (studentId === state.currentStudentId) {
      return { label: "目前報告", badgeClass: "status-current", rowClass: "row-current" };
    }
    if (studentId === state.nextStudentId) {
      return { label: "下一位", badgeClass: "status-next", rowClass: "row-next" };
    }
    if (state.drawnIds.indexOf(studentId) !== -1) {
      return { label: "已抽出", badgeClass: "status-drawn", rowClass: "" };
    }
    return { label: "未抽出", badgeClass: "status-pending", rowClass: "" };
  }

  function canEditExclusions() {
    return state.initialized && !state.error && state.drawnIds.length === 0;
  }

  function renderBanner() {
    if (state.error) {
      elements.errorBanner.textContent = state.error;
      elements.errorBanner.classList.remove("hidden");
      return;
    }

    if (state.initialized && getEligibleStudents().length === 0) {
      elements.errorBanner.textContent = "目前沒有可抽籤學生，請至少保留 1 位非作業未交學生。";
      elements.errorBanner.classList.remove("hidden");
      return;
    }

    elements.errorBanner.textContent = "";
    elements.errorBanner.classList.add("hidden");
  }

  function getEligibleStudents() {
    return state.students.filter(function (student) {
      return !isStudentExcluded(student);
    });
  }

  function isStudentExcluded(student) {
    return String(student["狀態"] || "").trim() === EXCLUDED_STATUS;
  }

  function getStudentId(student) {
    return String(student["學號"]);
  }

  function findStudent(studentId) {
    if (studentId === null) {
      return null;
    }
    return state.students.find(function (student) {
      return getStudentId(student) === studentId;
    }) || null;
  }

  function setError(message) {
    state.error = message;
    elements.errorBanner.textContent = message;
    elements.errorBanner.classList.remove("hidden");
  }

  function clearError() {
    state.error = "";
    elements.errorBanner.textContent = "";
    elements.errorBanner.classList.add("hidden");
  }

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  init();
})();
