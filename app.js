(function () {
  var STORAGE_KEY = "readroot-state-v1";
  var OPEN_LIBRARY_SEARCH = "https://openlibrary.org/search.json";
  var OPEN_LIBRARY_SUBJECTS = "https://openlibrary.org/subjects/";
  var COVER_URL = "https://covers.openlibrary.org/b/id/";

  var defaultState = {
    books: {},
    shelves: {
      want: [],
      reading: [],
      finished: []
    },
    logs: [],
    markedDays: [],
    goal: 12,
    weeklyGoal: 100,
    activeShelf: "want"
  };

  var state = loadState();
  var currentBook = null;
  var searchResults = [];
  var selectedMinutes = 20;
  var remainingSeconds = selectedMinutes * 60;
  var timerId = null;
  var supabaseConfig = window.READROOT_SUPABASE || {};
  var activeHabitPanel = "overview";
  var notePlaceholders = {
    Idea: "One idea worth remembering...",
    Quote: "Paste a short quote and why it stood out...",
    Summary: "Write a 2-3 line summary in your own words...",
    Action: "What will you try after reading this?"
  };
  var cloud = {
    client: null,
    enabled: false,
    session: null,
    user: null,
    profile: null,
    groups: [],
    selectedGroupId: "",
    board: "week",
    syncing: false
  };

  var els = {
    navButtons: document.querySelectorAll(".nav-button"),
    views: document.querySelectorAll(".view"),
    searchForm: document.getElementById("search-form"),
    searchInput: document.getElementById("search-input"),
    resultStatus: document.getElementById("result-status"),
    resultsGrid: document.getElementById("results-grid"),
    quickButtons: document.querySelectorAll("[data-query], [data-subject]"),
    shelfTabs: document.querySelectorAll("[data-shelf]"),
    habitTabs: document.querySelectorAll("[data-habit-panel]"),
    habitPanels: document.querySelectorAll("[data-habit-section]"),
    shelfGrid: document.getElementById("shelf-grid"),
    statBooks: document.getElementById("stat-books"),
    statPages: document.getElementById("stat-pages"),
    statStreak: document.getElementById("stat-streak"),
    goalInput: document.getElementById("goal-input"),
    goalCount: document.getElementById("goal-count"),
    goalMeter: document.getElementById("goal-meter"),
    saveGoal: document.getElementById("save-goal"),
    todayCaption: document.getElementById("today-caption"),
    todayDashboard: document.getElementById("today-dashboard"),
    weeklyGoalInput: document.getElementById("weekly-goal-input"),
    weeklyGoalCount: document.getElementById("weekly-goal-count"),
    weeklyGoalMeter: document.getElementById("weekly-goal-meter"),
    saveWeeklyGoal: document.getElementById("save-weekly-goal"),
    cloudBadge: document.getElementById("cloud-badge"),
    cloudStatus: document.getElementById("cloud-status"),
    authForm: document.getElementById("auth-form"),
    authEmail: document.getElementById("auth-email"),
    googleLogin: document.getElementById("google-login"),
    profilePanel: document.getElementById("profile-panel"),
    profileName: document.getElementById("profile-name"),
    profileUsername: document.getElementById("profile-username"),
    saveProfile: document.getElementById("save-profile"),
    signOut: document.getElementById("sign-out"),
    syncCloud: document.getElementById("sync-cloud"),
    dialog: document.getElementById("book-dialog"),
    dialogCover: document.getElementById("dialog-cover"),
    dialogAuthor: document.getElementById("dialog-author"),
    dialogTitle: document.getElementById("dialog-title"),
    dialogMeta: document.getElementById("dialog-meta"),
    dialogShelfButtons: document.querySelectorAll("[data-add-shelf]"),
    currentPage: document.getElementById("current-page"),
    totalPages: document.getElementById("total-pages"),
    saveProgress: document.getElementById("save-progress"),
    bookNoteType: document.getElementById("book-note-type"),
    bookNote: document.getElementById("book-note"),
    saveNote: document.getElementById("save-note"),
    bookNotesCount: document.getElementById("book-notes-count"),
    bookNotesList: document.getElementById("book-notes-list"),
    markRead: document.getElementById("mark-read"),
    timerDisplay: document.getElementById("timer-display"),
    timerState: document.getElementById("timer-state"),
    timerButtons: document.querySelectorAll("[data-minutes]"),
    startTimer: document.getElementById("start-timer"),
    pauseTimer: document.getElementById("pause-timer"),
    resetTimer: document.getElementById("reset-timer"),
    logForm: document.getElementById("log-form"),
    logBook: document.getElementById("log-book"),
    logPages: document.getElementById("log-pages"),
    logMinutes: document.getElementById("log-minutes"),
    logDateTime: document.getElementById("log-datetime"),
    logStatus: document.getElementById("log-status"),
    calendarCaption: document.getElementById("calendar-caption"),
    calendarGrid: document.getElementById("calendar-grid"),
    paceStats: document.getElementById("pace-stats"),
    predictionCount: document.getElementById("prediction-count"),
    predictionList: document.getElementById("prediction-list"),
    challengeCount: document.getElementById("challenge-count"),
    challengeList: document.getElementById("challenge-list"),
    leaderboardStatus: document.getElementById("leaderboard-status"),
    leaderboardList: document.getElementById("leaderboard-list"),
    leaderboardTabs: document.querySelectorAll("[data-board]"),
    leaderboardTabsWrap: document.getElementById("leaderboard-tabs"),
    groupTools: document.getElementById("group-tools"),
    groupSelect: document.getElementById("group-select"),
    createGroupForm: document.getElementById("create-group-form"),
    createGroupName: document.getElementById("create-group-name"),
    joinGroupForm: document.getElementById("join-group-form"),
    joinGroupCode: document.getElementById("join-group-code"),
    groupShare: document.getElementById("group-share"),
    groupCode: document.getElementById("group-code"),
    groupMembers: document.getElementById("group-members"),
    historyCount: document.getElementById("history-count"),
    historySummary: document.getElementById("history-summary"),
    historyList: document.getElementById("history-list"),
    notesList: document.getElementById("notes-list"),
    notesCount: document.getElementById("notes-count"),
    cardTemplate: document.getElementById("book-card-template")
  };

  bindEvents();
  renderAll();
  runInitialSearch();
  initCloud();
  registerServiceWorker();

  function bindEvents() {
    els.navButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        showView(button.dataset.view);
      });
    });

    els.searchForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var query = els.searchInput.value.trim();
      if (query) {
        searchBooks(query);
      }
    });

    els.quickButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var label = button.dataset.label || button.textContent.trim();
        setActiveCategory(button);
        els.searchInput.value = label;
        if (button.dataset.subject) {
          browseSubject(button.dataset.subject, label);
          return;
        }
        searchBooks(button.dataset.query || label, true);
      });
    });

    els.shelfTabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        state.activeShelf = tab.dataset.shelf;
        saveState();
        renderShelves();
      });
    });

    els.habitTabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        activeHabitPanel = tab.dataset.habitPanel || "overview";
        renderHabitPanels();
      });
    });

    els.saveGoal.addEventListener("click", function () {
      var nextGoal = Number(els.goalInput.value);
      if (Number.isFinite(nextGoal) && nextGoal > 0) {
        state.goal = Math.min(200, Math.round(nextGoal));
        saveState();
        renderStats();
      }
    });

    els.saveWeeklyGoal.addEventListener("click", function () {
      var nextGoal = Number(els.weeklyGoalInput.value);
      if (Number.isFinite(nextGoal) && nextGoal > 0) {
        state.weeklyGoal = Math.min(5000, Math.round(nextGoal));
        saveState();
        renderHabit();
      }
    });

    els.authForm.addEventListener("submit", function (event) {
      event.preventDefault();
      signInWithEmail();
    });

    els.googleLogin.addEventListener("click", signInWithGoogle);
    els.saveProfile.addEventListener("click", saveCloudProfile);
    els.signOut.addEventListener("click", signOutCloud);
    els.syncCloud.addEventListener("click", syncCloudData);

    els.groupSelect.addEventListener("change", function () {
      cloud.selectedGroupId = els.groupSelect.value;
      renderGroupControls();
      fetchLeaderboard();
    });

    els.createGroupForm.addEventListener("submit", function (event) {
      event.preventDefault();
      createReadingGroup();
    });

    els.joinGroupForm.addEventListener("submit", function (event) {
      event.preventDefault();
      joinReadingGroup();
    });

    els.leaderboardTabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        cloud.board = tab.dataset.board;
        renderLeaderboardTabs();
        fetchLeaderboard();
      });
    });

    els.dialogShelfButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        if (currentBook) {
          addToShelf(currentBook, button.dataset.addShelf);
          currentBook = state.books[currentBook.key] || currentBook;
          renderDialogShelfButtons(currentBook.key);
          renderAll();
        }
      });
    });

    els.saveProgress.addEventListener("click", function () {
      if (!currentBook) {
        return;
      }
      var book = ensureBook(currentBook);
      book.currentPage = clampNumber(els.currentPage.value, 0, 100000);
      book.totalPages = clampNumber(els.totalPages.value, 1, 100000);
      if (book.currentPage > book.totalPages) {
        book.currentPage = book.totalPages;
      }
      state.books[book.key] = book;
      saveState();
      renderAll();
      openBook(book);
    });

    els.bookNoteType.addEventListener("change", updateNotePlaceholder);

    els.saveNote.addEventListener("click", function () {
      if (!currentBook) {
        return;
      }
      var noteText = els.bookNote.value.trim();
      if (!noteText) {
        return;
      }
      var book = ensureBook(currentBook);
      var note = {
        id: "note-" + Date.now(),
        type: els.bookNoteType.value || "Idea",
        text: noteText,
        createdAt: new Date().toISOString()
      };
      book.notes = Array.isArray(book.notes) ? book.notes : [];
      book.notes.unshift(note);
      book.note = noteText;
      book.noteUpdatedAt = note.createdAt;
      state.books[book.key] = book;
      currentBook = book;
      els.bookNote.value = "";
      saveState();
      renderAll();
      renderBookDialogNotes(book);
    });

    els.markRead.addEventListener("click", function () {
      markToday();
    });

    els.timerButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        selectedMinutes = Number(button.dataset.minutes);
        remainingSeconds = selectedMinutes * 60;
        stopTimer("Ready");
        renderTimer();
        els.timerButtons.forEach(function (other) {
          other.classList.toggle("active", other === button);
        });
      });
    });

    els.startTimer.addEventListener("click", startTimer);
    els.pauseTimer.addEventListener("click", function () {
      stopTimer("Paused");
    });
    els.resetTimer.addEventListener("click", function () {
      remainingSeconds = selectedMinutes * 60;
      stopTimer("Ready");
      renderTimer();
    });

    els.logForm.addEventListener("submit", function (event) {
      event.preventDefault();
      logPages();
    });
  }

  async function initCloud() {
    if (!hasCloudConfig()) {
      cloud.enabled = false;
      renderCloudPanel();
      renderLeaderboardEmpty("Group leaderboards are available when accounts are connected.");
      return;
    }

    cloud.enabled = true;
    cloud.client = window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey);
    renderCloudPanel("Checking session...");

    var sessionResult = await cloud.client.auth.getSession();
    await handleCloudSession(sessionResult.data && sessionResult.data.session);

    cloud.client.auth.onAuthStateChange(function (_event, session) {
      handleCloudSession(session);
    });
  }

  function hasCloudConfig() {
    return Boolean(
      window.supabase &&
      supabaseConfig &&
      supabaseConfig.url &&
      supabaseConfig.anonKey &&
      !String(supabaseConfig.url).includes("YOUR_") &&
      !String(supabaseConfig.anonKey).includes("YOUR_")
    );
  }

  async function handleCloudSession(session) {
    cloud.session = session || null;
    cloud.user = session && session.user ? session.user : null;

    if (cloud.user) {
      await ensureCloudProfile();
      renderCloudPanel("Signed in. Saving local logs...");
      await syncCloudData({ silent: true });
      await fetchGroups();
    } else {
      cloud.profile = null;
      cloud.groups = [];
      cloud.selectedGroupId = "";
      renderCloudPanel();
      await fetchLeaderboard();
    }
  }

  async function signInWithEmail() {
    if (!cloud.enabled) {
      renderCloudPanel("Online backup is not available in this preview.");
      return;
    }

    var email = els.authEmail.value.trim();
    if (!email) {
      renderCloudPanel("Enter an email address.");
      return;
    }

    var result = await cloud.client.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: getRedirectUrl()
      }
    });

    if (result.error) {
      renderCloudPanel(result.error.message);
      return;
    }

    renderCloudPanel("Magic link sent. Check your email.");
  }

  async function signInWithGoogle() {
    if (!cloud.enabled) {
      renderCloudPanel("Online backup is not available in this preview.");
      return;
    }

    var result = await cloud.client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getRedirectUrl()
      }
    });

    if (result.error) {
      renderCloudPanel(result.error.message);
    }
  }

  async function signOutCloud() {
    if (!cloud.enabled) {
      return;
    }

    await cloud.client.auth.signOut();
    cloud.session = null;
    cloud.user = null;
    cloud.profile = null;
    cloud.groups = [];
    cloud.selectedGroupId = "";
    renderCloudPanel("Signed out. Your local data is still here.");
    await fetchLeaderboard();
  }

  async function ensureCloudProfile() {
    if (!cloud.enabled || !cloud.user) {
      return null;
    }

    var existing = await cloud.client
      .from("profiles")
      .select("*")
      .eq("id", cloud.user.id)
      .maybeSingle();

    if (existing.data) {
      cloud.profile = existing.data;
      return existing.data;
    }

    var emailName = (cloud.user.email || "reader").split("@")[0];
    var profile = {
      id: cloud.user.id,
      display_name: cloud.user.user_metadata && cloud.user.user_metadata.full_name ? cloud.user.user_metadata.full_name : emailName,
      username: sanitizeUsername(emailName) + "-" + cloud.user.id.slice(0, 6),
      visibility: "public"
    };

    var inserted = await cloud.client
      .from("profiles")
      .upsert(profile)
      .select("*")
      .single();

    cloud.profile = inserted.data || profile;
    return cloud.profile;
  }

  async function saveCloudProfile() {
    if (!cloud.enabled || !cloud.user) {
      renderCloudPanel("Sign in before saving a profile.");
      return;
    }

    var username = sanitizeUsername(els.profileUsername.value);
    if (!username || username.length < 3) {
      renderCloudPanel("Username needs at least 3 letters or numbers.");
      return;
    }

    var profile = {
      id: cloud.user.id,
      display_name: els.profileName.value.trim() || "Reader",
      username: username,
      visibility: "public",
      updated_at: new Date().toISOString()
    };

    var result = await cloud.client
      .from("profiles")
      .upsert(profile)
      .select("*")
      .single();

    if (result.error) {
      renderCloudPanel(result.error.message);
      return;
    }

    cloud.profile = result.data;
    renderCloudPanel("Profile saved.");
    await fetchLeaderboard();
  }

  async function syncCloudData(options) {
    if (!cloud.enabled || !cloud.user) {
      renderCloudPanel("Sign in to save your reading logs.");
      return;
    }

    cloud.syncing = true;
    if (!options || !options.silent) {
      renderCloudPanel("Saving local logs...");
    }

    ensureLogIds();
    var rows = state.logs.map(toCloudLogRow).filter(Boolean);
    if (rows.length) {
      var result = await cloud.client
        .from("reading_logs")
        .upsert(rows, { onConflict: "id" });

      if (result.error) {
        cloud.syncing = false;
        renderCloudPanel(result.error.message);
        return;
      }
    }

    cloud.syncing = false;
    renderCloudPanel(rows.length ? rows.length + " reading logs saved." : "Nothing to save yet.");
    await fetchLeaderboard();
  }

  async function syncLogToCloud(log) {
    try {
      if (!cloud.enabled || !cloud.user || !log) {
        return;
      }

      var row = toCloudLogRow(log);
      if (!row) {
        return;
      }

      await cloud.client
        .from("reading_logs")
        .upsert(row, { onConflict: "id" });
      await fetchLeaderboard();
    } catch (error) {
      renderCloudPanel("Saved locally. Online backup will retry later.");
    }
  }

  async function fetchGroups() {
    if (!cloud.enabled || !cloud.user) {
      cloud.groups = [];
      cloud.selectedGroupId = "";
      renderGroupControls();
      return;
    }

    var result = await cloud.client.rpc("my_reading_groups");
    if (result.error) {
      renderLeaderboardEmpty(result.error.message);
      return;
    }

    cloud.groups = result.data || [];
    if (!cloud.groups.some(function (group) {
      return group.id === cloud.selectedGroupId;
    })) {
      cloud.selectedGroupId = cloud.groups.length ? cloud.groups[0].id : "";
    }
    renderGroupControls();
    await fetchLeaderboard();
  }

  async function createReadingGroup() {
    if (!cloud.enabled) {
      renderLeaderboardEmpty("Group leaderboards are not available in this preview.");
      return;
    }

    if (!cloud.user) {
      renderLeaderboardEmpty("Sign in to create a private reading group.");
      return;
    }

    var name = els.createGroupName.value.trim();
    if (name.length < 2) {
      renderLeaderboardEmpty("Group name needs at least 2 characters.");
      return;
    }

    els.leaderboardStatus.textContent = "Creating group...";
    var result = await cloud.client.rpc("create_reading_group", { group_name: name });
    if (result.error) {
      renderLeaderboardEmpty(result.error.message);
      return;
    }

    els.createGroupName.value = "";
    cloud.selectedGroupId = result.data && result.data.id ? result.data.id : cloud.selectedGroupId;
    await fetchGroups();
  }

  async function joinReadingGroup() {
    if (!cloud.enabled) {
      renderLeaderboardEmpty("Group leaderboards are not available in this preview.");
      return;
    }

    if (!cloud.user) {
      renderLeaderboardEmpty("Sign in to join a private reading group.");
      return;
    }

    var code = els.joinGroupCode.value.trim().toUpperCase();
    if (code.length < 4) {
      renderLeaderboardEmpty("Enter a valid invite code.");
      return;
    }

    els.leaderboardStatus.textContent = "Joining group...";
    var result = await cloud.client.rpc("join_reading_group", { code: code });
    if (result.error) {
      renderLeaderboardEmpty(result.error.message);
      return;
    }

    els.joinGroupCode.value = "";
    cloud.selectedGroupId = result.data && result.data.id ? result.data.id : cloud.selectedGroupId;
    await fetchGroups();
  }

  function toCloudLogRow(log) {
    var pages = Number(log.pages) || 0;
    if (!pages || !cloud.user) {
      return null;
    }

    var book = state.books[log.key] || {};
    return {
      id: log.id || "log-" + safeSlug(log.key || "book") + "-" + safeSlug(log.createdAt || log.readAt || String(Date.now())),
      user_id: cloud.user.id,
      openlibrary_key: log.key || "",
      book_title: log.title || book.title || "Reading session",
      book_author: log.author || book.author || "",
      pages: pages,
      minutes: Number(log.minutes) || 0,
      read_at: getLogDate(log).toISOString(),
      created_at: log.createdAt || new Date().toISOString()
    };
  }

  function ensureLogIds() {
    var changed = false;
    state.logs.forEach(function (log, index) {
      if (!log.id) {
        log.id = "log-" + Date.now() + "-" + index;
        changed = true;
      }
    });
    if (changed) {
      saveState();
    }
  }

  async function fetchLeaderboard() {
    renderLeaderboardTabs();
    renderGroupControls();
    if (!cloud.enabled) {
      renderLeaderboardEmpty("Group leaderboards are available when accounts are connected.");
      return;
    }

    if (!cloud.user) {
      renderLeaderboardEmpty("Sign in to create or join a private reading group.");
      return;
    }

    if (!cloud.selectedGroupId) {
      renderLeaderboardEmpty("Create a group or join one with an invite code.");
      return;
    }

    els.leaderboardStatus.textContent = "Loading...";
    var result = await cloud.client.rpc("group_leaderboard", {
      group_id_input: cloud.selectedGroupId,
      period: cloud.board
    });
    if (result.error) {
      renderLeaderboardEmpty(result.error.message);
      return;
    }

    renderLeaderboard(result.data || []);
  }

  function renderLeaderboard(rows) {
    var selectedGroup = getSelectedGroup();
    els.leaderboardStatus.textContent = selectedGroup ? selectedGroup.name : "Group leaderboard";
    els.leaderboardList.innerHTML = "";

    if (!rows.length) {
      els.leaderboardList.innerHTML = emptyState("No group entries yet. Sync a reading log to start the competition.");
      return;
    }

    rows.forEach(function (row, index) {
      var item = document.createElement("article");
      item.className = "leaderboard-item";
      item.innerHTML = "<div class=\"leaderboard-rank\"></div><div class=\"leaderboard-name\"><strong></strong><span></span></div><div class=\"leaderboard-score\"><strong></strong><span></span></div>";
      item.querySelector(".leaderboard-rank").textContent = String(index + 1);
      item.querySelector(".leaderboard-name strong").textContent = row.display_name || "Reader";
      item.querySelector(".leaderboard-name span").textContent = row.username ? "@" + row.username : "public reader";
      item.querySelector(".leaderboard-score strong").textContent = String(row.total_pages || 0);
      item.querySelector(".leaderboard-score span").textContent = (row.sessions || 0) + " sessions";
      els.leaderboardList.appendChild(item);
    });
  }

  function renderLeaderboardEmpty(message) {
    els.leaderboardStatus.textContent = cloud.enabled ? "Group mode" : "Offline";
    els.leaderboardList.innerHTML = emptyState(message);
  }

  function renderLeaderboardTabs() {
    els.leaderboardTabs.forEach(function (tab) {
      var active = tab.dataset.board === cloud.board;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
  }

  function renderCloudPanel(message) {
    var signedIn = Boolean(cloud.user);
    var showAuth = Boolean(cloud.enabled && !signedIn);
    els.cloudBadge.textContent = cloud.enabled ? signedIn ? "Signed in" : "Ready" : "On device";
    els.authForm.hidden = !showAuth;
    els.googleLogin.hidden = !showAuth;
    els.profilePanel.hidden = !signedIn;
    els.authEmail.disabled = !cloud.enabled;
    els.authForm.querySelector("button").disabled = !cloud.enabled;
    els.googleLogin.disabled = !cloud.enabled;
    els.syncCloud.disabled = !signedIn || cloud.syncing;

    if (signedIn) {
      els.profileName.value = cloud.profile && cloud.profile.display_name ? cloud.profile.display_name : "";
      els.profileUsername.value = cloud.profile && cloud.profile.username ? cloud.profile.username : "";
    }

    if (message) {
      els.cloudStatus.textContent = message;
    } else if (!cloud.enabled) {
      els.cloudStatus.textContent = "Your reading data stays in this browser on this device.";
    } else if (signedIn) {
      els.cloudStatus.textContent = cloud.user.email || "Signed in";
    } else {
      els.cloudStatus.textContent = "Sign in to save progress and join reading groups.";
    }

    renderGroupControls();
  }

  function renderGroupControls() {
    var signedIn = Boolean(cloud.user);
    var enabled = Boolean(cloud.enabled && signedIn);

    els.groupTools.hidden = !enabled;
    els.leaderboardTabsWrap.hidden = !enabled || !cloud.selectedGroupId;
    els.groupSelect.disabled = !enabled;
    els.createGroupName.disabled = !enabled;
    els.createGroupForm.querySelector("button").disabled = !enabled;
    els.joinGroupCode.disabled = !enabled;
    els.joinGroupForm.querySelector("button").disabled = !enabled;

    els.groupSelect.innerHTML = "";
    if (!enabled) {
      els.groupShare.hidden = true;
      return;
    }

    if (!cloud.groups.length) {
      var emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "No groups yet";
      els.groupSelect.appendChild(emptyOption);
      els.groupShare.hidden = true;
      els.leaderboardTabsWrap.hidden = true;
      return;
    }

    cloud.groups.forEach(function (group) {
      var option = document.createElement("option");
      option.value = group.id;
      option.textContent = group.name;
      els.groupSelect.appendChild(option);
    });
    els.groupSelect.value = cloud.selectedGroupId;

    var selectedGroup = getSelectedGroup();
    if (selectedGroup) {
      els.groupShare.hidden = false;
      els.groupCode.textContent = selectedGroup.invite_code || "-";
      els.groupMembers.textContent = (selectedGroup.member_count || 1) + ((selectedGroup.member_count || 1) === 1 ? " member" : " members");
    } else {
      els.groupShare.hidden = true;
    }
  }

  function getSelectedGroup() {
    return cloud.groups.find(function (group) {
      return group.id === cloud.selectedGroupId;
    }) || null;
  }

  function getRedirectUrl() {
    return window.location.href.split("#")[0];
  }

  function loadState() {
    try {
      var stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!stored) {
        return structuredClone(defaultState);
      }
      return {
        books: stored.books || {},
        shelves: {
          want: Array.isArray(stored.shelves && stored.shelves.want) ? stored.shelves.want : [],
          reading: Array.isArray(stored.shelves && stored.shelves.reading) ? stored.shelves.reading : [],
          finished: Array.isArray(stored.shelves && stored.shelves.finished) ? stored.shelves.finished : []
        },
        logs: Array.isArray(stored.logs) ? stored.logs : [],
        markedDays: Array.isArray(stored.markedDays) ? stored.markedDays : [],
        goal: Number(stored.goal) || 12,
        weeklyGoal: Number(stored.weeklyGoal) || 100,
        activeShelf: stored.activeShelf || "want"
      };
    } catch (error) {
      return structuredClone(defaultState);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function showView(viewName) {
    els.navButtons.forEach(function (button) {
      button.classList.toggle("active", button.dataset.view === viewName);
    });
    els.views.forEach(function (view) {
      view.classList.toggle("active", view.id === viewName + "-view");
    });
    if (viewName === "shelves") {
      renderShelves();
    }
    if (viewName === "habit") {
      renderHabit();
    }
  }

  function runInitialSearch() {
    els.searchInput.value = "Indian literature";
    searchBooks("Indian literature");
  }

  async function searchBooks(query, keepActiveCategory) {
    if (!keepActiveCategory) {
      setActiveCategory(null);
    }
    els.resultStatus.textContent = "Searching...";
    els.resultsGrid.innerHTML = "";
    try {
      var url = new URL(OPEN_LIBRARY_SEARCH);
      url.searchParams.set("q", query);
      url.searchParams.set("limit", "12");
      url.searchParams.set("fields", "key,title,author_name,first_publish_year,cover_i,edition_count,number_of_pages_median,isbn,subject");
      var response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error("Search failed");
      }
      var payload = await response.json();
      searchResults = (payload.docs || []).map(normalizeSearchDoc);
      els.resultStatus.textContent = searchResults.length ? searchResults.length + " matches" : "No matches";
      renderBookGrid(els.resultsGrid, searchResults);
    } catch (error) {
      els.resultStatus.textContent = "Search unavailable";
      els.resultsGrid.innerHTML = emptyState("Could not reach Open Library right now.");
    }
  }

  async function browseSubject(subject, label) {
    els.resultStatus.textContent = "Loading " + label + "...";
    els.resultsGrid.innerHTML = "";
    try {
      var url = new URL(subject + ".json", OPEN_LIBRARY_SUBJECTS);
      url.searchParams.set("limit", "12");
      var response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error("Subject failed");
      }
      var payload = await response.json();
      searchResults = (payload.works || []).map(normalizeSubjectWork);
      els.resultStatus.textContent = searchResults.length ? label + " / " + searchResults.length + " picks" : "No matches";
      renderBookGrid(els.resultsGrid, searchResults);
    } catch (error) {
      els.resultStatus.textContent = "Category unavailable";
      els.resultsGrid.innerHTML = emptyState("Could not load " + label + " right now.");
    }
  }

  function normalizeSearchDoc(doc) {
    var isbn = Array.isArray(doc.isbn) && doc.isbn.length ? doc.isbn[0] : "";
    return {
      key: doc.key || "book-" + safeSlug(doc.title || "") + "-" + (doc.first_publish_year || ""),
      title: doc.title || "Untitled",
      author: Array.isArray(doc.author_name) ? doc.author_name.slice(0, 2).join(", ") : "Unknown author",
      year: doc.first_publish_year || "",
      coverId: doc.cover_i || "",
      pages: doc.number_of_pages_median || "",
      catalogPages: doc.number_of_pages_median || "",
      isbn: isbn,
      subjects: Array.isArray(doc.subject) ? doc.subject.slice(0, 4) : []
    };
  }

  function normalizeSubjectWork(work) {
    return {
      key: work.key || "book-" + safeSlug(work.title || ""),
      title: work.title || "Untitled",
      author: Array.isArray(work.authors) ? work.authors.map(function (author) {
        return author.name;
      }).filter(Boolean).slice(0, 2).join(", ") : "Unknown author",
      year: work.first_publish_year || "",
      coverId: work.cover_id || "",
      pages: "",
      catalogPages: "",
      isbn: "",
      subjects: Array.isArray(work.subject) ? work.subject.slice(0, 4) : []
    };
  }

  function setActiveCategory(activeButton) {
    els.quickButtons.forEach(function (button) {
      button.classList.toggle("active", button === activeButton);
    });
  }

  function renderAll() {
    renderStats();
    renderShelves();
    renderHabitPanels();
    renderHabit();
    renderTimer();
    renderCloudPanel();
    renderLeaderboardTabs();
  }

  function renderStats() {
    var finishedCount = state.shelves.finished.length;
    var totalBooks = Object.keys(state.books).length;
    var pages = state.logs.reduce(function (sum, log) {
      return sum + (Number(log.pages) || 0);
    }, 0);
    var streak = getCurrentStreak();
    var goal = Math.max(1, Number(state.goal) || 12);
    var percent = Math.min(100, Math.round((finishedCount / goal) * 100));

    els.statBooks.textContent = String(totalBooks);
    els.statPages.textContent = String(pages);
    els.statStreak.textContent = String(streak);
    els.goalInput.value = String(goal);
    els.goalCount.textContent = finishedCount + " / " + goal;
    els.goalMeter.style.width = percent + "%";
  }

  function renderBookGrid(container, books) {
    container.innerHTML = "";
    if (!books.length) {
      container.innerHTML = emptyState("No books here yet.");
      return;
    }
    books.forEach(function (book) {
      container.appendChild(createBookCard(book));
    });
  }

  function createBookCard(rawBook) {
    var savedBook = state.books[rawBook.key] || rawBook;
    var activeShelf = getBookShelf(savedBook.key);
    var card = els.cardTemplate.content.firstElementChild.cloneNode(true);
    var cover = card.querySelector(".cover-frame");
    var title = card.querySelector(".book-title");
    var author = card.querySelector(".book-author");
    var meta = card.querySelector(".book-meta");
    var progress = card.querySelector(".progress-line span");
    var open = card.querySelector(".card-open");

    renderCover(cover, savedBook);
    title.textContent = savedBook.title;
    author.textContent = savedBook.author || "Unknown author";
    meta.textContent = buildMeta(savedBook);
    progress.style.width = getProgressPercent(savedBook) + "%";
    open.setAttribute("aria-label", "Open " + savedBook.title);
    open.addEventListener("click", function () {
      openBook(savedBook);
    });

    card.querySelectorAll("[data-shelf-action]").forEach(function (button) {
      var selected = button.dataset.shelfAction === activeShelf;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.addEventListener("click", function () {
        addToShelf(savedBook, button.dataset.shelfAction);
        renderAll();
      });
    });

    return card;
  }

  function renderCover(container, book) {
    container.innerHTML = "";
    if (book.coverId) {
      var img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.src = COVER_URL + book.coverId + "-M.jpg";
      img.onerror = function () {
        container.innerHTML = fallbackCover(book);
      };
      container.appendChild(img);
    } else {
      container.innerHTML = fallbackCover(book);
    }
  }

  function fallbackCover(book) {
    return '<span class="cover-fallback">' + escapeHtml(book.title || "Book") + "</span>";
  }

  function buildMeta(book) {
    var bits = [];
    if (book.year) {
      bits.push("Published " + book.year);
    }
    if (book.catalogPages) {
      bits.push("About " + book.catalogPages + " pages");
    } else if (book.totalPages) {
      bits.push(book.totalPages + " pages");
    }
    return bits.join(" / ") || "Book";
  }

  function addToShelf(rawBook, shelf) {
    var book = ensureBook(rawBook);
    state.books[book.key] = book;
    Object.keys(state.shelves).forEach(function (name) {
      state.shelves[name] = state.shelves[name].filter(function (key) {
        return key !== book.key;
      });
    });
    state.shelves[shelf].unshift(book.key);
    if (shelf === "finished" && !book.finishedAt) {
      book.finishedAt = new Date().toISOString();
    }
    if (shelf !== "finished") {
      book.finishedAt = "";
    }
    state.activeShelf = shelf;
    saveState();
  }

  function getBookShelf(bookKey) {
    return Object.keys(state.shelves).find(function (shelf) {
      return state.shelves[shelf].includes(bookKey);
    }) || "";
  }

  function ensureBook(rawBook) {
    var existing = state.books[rawBook.key] || {};
    return Object.assign({}, rawBook, existing, {
      key: rawBook.key,
      title: rawBook.title || existing.title || "Untitled",
      author: rawBook.author || existing.author || "Unknown author",
      year: rawBook.year || existing.year || "",
      coverId: rawBook.coverId || existing.coverId || "",
      pages: existing.pages || "",
      catalogPages: Number(existing.catalogPages) || Number(rawBook.catalogPages) || Number(rawBook.pages) || Number(existing.pages) || 0,
      subjects: rawBook.subjects || existing.subjects || [],
      currentPage: Number(existing.currentPage) || 0,
      totalPages: Number(existing.totalPages) || 0,
      note: typeof existing.note === "string" ? existing.note : "",
      noteUpdatedAt: existing.noteUpdatedAt || "",
      notes: Array.isArray(existing.notes) ? existing.notes : [],
      addedAt: existing.addedAt || new Date().toISOString()
    });
  }

  function renderShelves() {
    els.shelfTabs.forEach(function (tab) {
      var active = tab.dataset.shelf === state.activeShelf;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    var keys = state.shelves[state.activeShelf] || [];
    var books = keys.map(function (key) {
      return state.books[key];
    }).filter(Boolean);
    renderBookGrid(els.shelfGrid, books);
  }

  function renderHabitPanels() {
    els.habitTabs.forEach(function (tab) {
      var active = tab.dataset.habitPanel === activeHabitPanel;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    els.habitPanels.forEach(function (panel) {
      var active = panel.dataset.habitSection === activeHabitPanel;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    });
  }

  function openBook(rawBook) {
    currentBook = ensureBook(rawBook);
    renderCover(els.dialogCover, currentBook);
    els.dialogAuthor.textContent = currentBook.author || "Unknown author";
    els.dialogTitle.textContent = currentBook.title;
    els.dialogMeta.textContent = buildMeta(currentBook);
    els.currentPage.value = currentBook.currentPage || 0;
    els.totalPages.value = currentBook.totalPages || "";
    els.bookNoteType.value = "Idea";
    els.bookNote.value = "";
    updateNotePlaceholder();
    renderDialogShelfButtons(currentBook.key);
    renderBookDialogNotes(currentBook);

    if (typeof els.dialog.showModal === "function") {
      els.dialog.showModal();
    } else {
      alert(currentBook.title);
    }
  }

  function renderDialogShelfButtons(bookKey) {
    var activeShelf = getBookShelf(bookKey);
    els.dialogShelfButtons.forEach(function (button) {
      var selected = button.dataset.addShelf === activeShelf;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function updateNotePlaceholder() {
    var type = els.bookNoteType.value || "Idea";
    els.bookNote.placeholder = notePlaceholders[type] || notePlaceholders.Idea;
  }

  function renderHabit() {
    renderLogBookOptions();
    setDefaultLogDateTime();
    renderTodayDashboard();
    renderWeeklyGoal();
    renderCalendar();
    renderPaceStats();
    renderPredictions();
    renderChallenges();
    renderHistory();
    renderNotes();
    renderStats();
  }

  function renderLogBookOptions() {
    var readingKeys = state.shelves.reading.concat(state.shelves.want, state.shelves.finished);
    var seen = new Set();
    var options = readingKeys.filter(function (key) {
      if (seen.has(key) || !state.books[key]) {
        return false;
      }
      seen.add(key);
      return true;
    });

    els.logBook.innerHTML = "";
    if (!options.length) {
      var empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "Add a book first";
      els.logBook.appendChild(empty);
      return;
    }

    options.forEach(function (key) {
      var option = document.createElement("option");
      option.value = key;
      option.textContent = state.books[key].title;
      els.logBook.appendChild(option);
    });
  }

  function logPages() {
    var key = els.logBook.value;
    var pages = clampNumber(els.logPages.value, 1, 2000);
    var minutes = clampNumber(els.logMinutes.value, 0, 1440);
    var readAt = parseDateTimeInput(els.logDateTime.value);
    if (!key || !state.books[key] || !pages) {
      els.logStatus.textContent = "Select a book";
      return;
    }
    var book = state.books[key];
    var current = Number(book.currentPage) || 0;
    var total = Number(book.totalPages) || 0;
    book.currentPage = total ? Math.min(total, current + pages) : current + pages;
    var log = {
      id: "log-" + Date.now(),
      key: key,
      title: book.title,
      author: book.author || "",
      pages: pages,
      minutes: minutes,
      date: formatDate(readAt),
      readAt: readAt.toISOString(),
      pageAfter: book.currentPage,
      totalPages: total || "",
      createdAt: new Date().toISOString()
    };
    state.logs.unshift(log);
    markDay(formatDate(readAt), false);
    els.logPages.value = "";
    els.logMinutes.value = "";
    els.logDateTime.value = toLocalDateTimeInputValue(new Date());
    els.logStatus.textContent = pages + " pages logged";
    saveState();
    renderAll();
    syncLogToCloud(log);
  }

  function markToday(saveImmediately) {
    markDay(todayString(), saveImmediately);
  }

  function markDay(dateString, saveImmediately) {
    if (!state.markedDays.includes(dateString)) {
      state.markedDays.push(dateString);
    }
    if (saveImmediately !== false) {
      saveState();
      renderAll();
    }
  }

  function getCurrentStreak() {
    var daySet = new Set(state.markedDays);
    var streak = 0;
    var cursor = new Date();
    while (daySet.has(formatDate(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function renderTodayDashboard() {
    var logs = getSortedLogs();
    var today = todayString();
    var todayLogs = logs.filter(function (log) {
      return formatDate(getLogDate(log)) === today;
    });
    var todayPages = todayLogs.reduce(sumPages, 0);
    var todayMinutes = todayLogs.reduce(sumMinutes, 0);
    var activeBook = getActiveReadingBooks()[0];
    var nextAction = getNextAction(activeBook);

    els.todayCaption.textContent = todayPages ? todayPages + " pages logged today" : "Small steps count.";
    els.todayDashboard.innerHTML = "";
    [
      {
        value: todayPages,
        label: "pages today",
        detail: todayMinutes ? todayMinutes + " minutes logged" : "No timed session yet"
      },
      {
        value: todayLogs.length,
        label: "sessions today",
        detail: todayLogs.length ? "Logged and saved" : "Start with one short session"
      },
      {
        value: getCurrentStreak(),
        label: "day streak",
        detail: state.markedDays.includes(today) ? "ReadRoot has today marked" : "Mark today after reading"
      },
      {
        value: nextAction.value,
        label: "next action",
        detail: nextAction.detail
      }
    ].forEach(function (item) {
      els.todayDashboard.appendChild(createMetricCard(item));
    });
  }

  function renderWeeklyGoal() {
    var goal = Math.max(1, Number(state.weeklyGoal) || 100);
    var weekPages = getPagesSince(startOfWeek(new Date()));
    var percent = Math.min(100, Math.round((weekPages / goal) * 100));
    els.weeklyGoalInput.value = String(goal);
    els.weeklyGoalCount.textContent = weekPages + " / " + goal;
    els.weeklyGoalMeter.style.width = percent + "%";
  }

  function renderCalendar() {
    var pagesByDate = getPagesByDate();
    var markedDays = new Set(state.markedDays);
    var today = startOfDay(new Date());
    els.calendarGrid.innerHTML = "";

    for (var index = 34; index >= 0; index -= 1) {
      var date = addDays(today, -index);
      var key = formatDate(date);
      var pages = pagesByDate[key] || 0;
      var readOnlyMark = markedDays.has(key) && !pages;
      var level = getCalendarLevel(pages, readOnlyMark);
      var item = document.createElement("div");
      item.className = "calendar-day";
      item.dataset.level = String(level);
      item.title = formatLongDate(date) + (pages ? " / " + pages + " pages" : readOnlyMark ? " / marked read" : "");
      item.innerHTML = "<strong></strong><small></small>";
      item.querySelector("strong").textContent = String(date.getDate());
      item.querySelector("small").textContent = pages ? pages + "p" : readOnlyMark ? "read" : "";
      els.calendarGrid.appendChild(item);
    }
  }

  function renderPaceStats() {
    var logs = getSortedLogs();
    var totalPages = logs.reduce(sumPages, 0);
    var readingDays = getReadingDayKeys().length;
    var averageSession = logs.length ? Math.round(totalPages / logs.length) : 0;
    var averageDay = readingDays ? Math.round(totalPages / readingDays) : 0;
    var bestDay = getBestReadingDay();
    var activeHour = getMostActiveHour();

    els.paceStats.innerHTML = "";
    [
      {
        value: averageSession,
        label: "avg pages/session",
        detail: logs.length ? logs.length + " logged sessions" : "Log a session to calculate"
      },
      {
        value: averageDay,
        label: "avg pages/day",
        detail: readingDays ? readingDays + " reading days" : "No reading days yet"
      },
      {
        value: bestDay.pages,
        label: "best day pages",
        detail: bestDay.date ? formatShortDate(bestDay.date) : "No best day yet"
      },
      {
        value: activeHour.label,
        label: "active time",
        detail: activeHour.count ? activeHour.count + " sessions around then" : "No pattern yet"
      }
    ].forEach(function (item) {
      els.paceStats.appendChild(createMetricCard(item));
    });
  }

  function renderPredictions() {
    var books = getActiveReadingBooks();
    var averagePages = getAveragePagesPerDay(14) || getAveragePagesPerDay(60);
    els.predictionCount.textContent = books.length ? books.length + " active" : "Reading shelf";
    els.predictionList.innerHTML = "";

    if (!books.length) {
      els.predictionList.innerHTML = emptyState("Move a book to Reading to see finish predictions.");
      return;
    }

    books.forEach(function (book) {
      var total = Number(book.totalPages) || 0;
      var current = Number(book.currentPage) || 0;
      var remaining = Math.max(0, total - current);
      var item = document.createElement("article");
      item.className = "prediction-item";
      item.innerHTML = "<strong></strong><span></span><p></p>";
      item.querySelector("strong").textContent = book.title;
      item.querySelector("span").textContent = total ? current + " / " + total + " pages" : "Total pages needed";

      if (!total) {
        item.querySelector("p").textContent = "Add total pages in book details to calculate a finish date.";
      } else if (!remaining) {
        item.querySelector("p").textContent = "This book is ready to move to Finished.";
      } else if (!averagePages) {
        item.querySelector("p").textContent = remaining + " pages left. Log a few sessions to estimate a finish date.";
      } else {
        var days = Math.max(1, Math.ceil(remaining / averagePages));
        item.querySelector("p").textContent = remaining + " pages left. At " + averagePages + " pages/day, finish around " + formatShortDate(addDays(new Date(), days)) + ".";
      }

      els.predictionList.appendChild(item);
    });
  }

  function renderChallenges() {
    var now = new Date();
    var weekPages = getPagesSince(startOfWeek(now));
    var monthPages = getPagesSince(startOfMonth(now));
    var monthDays = getReadingDayKeys().filter(function (key) {
      return key >= formatDate(startOfMonth(now));
    }).length;
    var finishedThisMonth = getFinishedBooksSince(startOfMonth(now));
    var challenges = [
      {
        title: "7 reading days",
        value: monthDays,
        goal: 7,
        text: "Read on 7 separate days this month."
      },
      {
        title: "500 page month",
        value: monthPages,
        goal: 500,
        text: "Build volume without rushing."
      },
      {
        title: "Weekly goal",
        value: weekPages,
        goal: Math.max(1, Number(state.weeklyGoal) || 100),
        text: "Hit your custom weekly page target."
      },
      {
        title: "Finish one book",
        value: finishedThisMonth,
        goal: 1,
        text: "Complete one book this month."
      }
    ];
    var completed = challenges.filter(function (challenge) {
      return challenge.value >= challenge.goal;
    }).length;

    els.challengeCount.textContent = completed + " / " + challenges.length + " complete";
    els.challengeList.innerHTML = "";
    challenges.forEach(function (challenge) {
      var progress = Math.min(100, Math.round((challenge.value / challenge.goal) * 100));
      var card = document.createElement("article");
      card.className = "challenge-card";
      card.innerHTML = "<strong></strong><span></span><div class=\"meter\"><span></span></div><p></p>";
      card.querySelector("strong").textContent = Math.min(challenge.value, challenge.goal) + " / " + challenge.goal;
      card.querySelector("span").textContent = challenge.title;
      card.querySelector(".meter span").style.width = progress + "%";
      card.querySelector("p").textContent = challenge.text;
      els.challengeList.appendChild(card);
    });
  }

  function renderHistory() {
    var logs = getSortedLogs();
    var today = todayString();
    var todayPages = logs.filter(function (log) {
      return formatDate(getLogDate(log)) === today;
    }).reduce(sumPages, 0);
    var sevenDayPages = logs.filter(function (log) {
      return isWithinLastDays(getLogDate(log), 7);
    }).reduce(sumPages, 0);
    var totalMinutes = logs.reduce(function (sum, log) {
      return sum + (Number(log.minutes) || 0);
    }, 0);

    els.historyCount.textContent = logs.length + (logs.length === 1 ? " session" : " sessions");
    els.historySummary.innerHTML = "";
    [
      { value: todayPages, label: "pages today" },
      { value: sevenDayPages, label: "pages in 7 days" },
      { value: logs.length, label: "total sessions" },
      { value: totalMinutes, label: "minutes logged" }
    ].forEach(function (item) {
      var tile = document.createElement("div");
      tile.innerHTML = "<strong></strong><span></span>";
      tile.querySelector("strong").textContent = String(item.value);
      tile.querySelector("span").textContent = item.label;
      els.historySummary.appendChild(tile);
    });

    els.historyList.innerHTML = "";
    if (!logs.length) {
      els.historyList.innerHTML = emptyState("Your reading sessions will appear here.");
      return;
    }

    logs.slice(0, 20).forEach(function (log) {
      var item = document.createElement("article");
      item.className = "history-item";

      var details = document.createElement("div");
      var title = document.createElement("strong");
      var meta = document.createElement("p");
      title.textContent = log.title || "Reading session";
      meta.textContent = buildHistoryMeta(log);
      details.appendChild(title);
      details.appendChild(meta);

      var time = document.createElement("div");
      time.className = "history-time";
      time.textContent = formatDisplayDateTime(getLogDate(log));

      item.appendChild(details);
      item.appendChild(time);
      els.historyList.appendChild(item);
    });
  }

  function renderNotes() {
    var notes = Object.values(state.books).flatMap(function (book) {
      return getBookNotes(book).map(function (note) {
        return Object.assign({}, note, { bookTitle: book.title });
      });
    }).sort(function (a, b) {
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    })
      .slice(0, 5);

    els.notesCount.textContent = notes.length + (notes.length === 1 ? " note" : " notes");
    els.notesList.innerHTML = "";
    if (!notes.length) {
      els.notesList.innerHTML = emptyState("Your notes will appear here.");
      return;
    }
    notes.forEach(function (book) {
      var item = document.createElement("article");
      item.className = "note-item";
      item.innerHTML = "<strong></strong><span class=\"note-meta\"></span><p></p>";
      item.querySelector("strong").textContent = book.bookTitle;
      item.querySelector(".note-meta").textContent = book.type + " / " + formatDisplayDateTime(new Date(book.createdAt));
      item.querySelector("p").textContent = book.text;
      els.notesList.appendChild(item);
    });
  }

  function renderBookDialogNotes(book) {
    var notes = getBookNotes(book);
    els.bookNotesCount.textContent = notes.length + (notes.length === 1 ? " note" : " notes");
    els.bookNotesList.innerHTML = "";
    if (!notes.length) {
      els.bookNotesList.innerHTML = emptyState("Notes you add for this book will appear here.");
      return;
    }

    notes.slice(0, 8).forEach(function (note) {
      var item = document.createElement("article");
      item.className = "note-item";
      item.innerHTML = "<strong></strong><span class=\"note-meta\"></span><p></p>";
      item.querySelector("strong").textContent = note.type;
      item.querySelector(".note-meta").textContent = formatDisplayDateTime(new Date(note.createdAt));
      item.querySelector("p").textContent = note.text;
      els.bookNotesList.appendChild(item);
    });
  }

  function startTimer() {
    if (timerId) {
      return;
    }
    els.timerState.textContent = "Running";
    timerId = window.setInterval(function () {
      remainingSeconds -= 1;
      if (remainingSeconds <= 0) {
        remainingSeconds = 0;
        stopTimer("Done");
        markToday();
      }
      renderTimer();
    }, 1000);
  }

  function stopTimer(label) {
    if (timerId) {
      window.clearInterval(timerId);
      timerId = null;
    }
    els.timerState.textContent = label;
  }

  function renderTimer() {
    var minutes = Math.floor(remainingSeconds / 60);
    var seconds = remainingSeconds % 60;
    els.timerDisplay.textContent = pad(minutes) + ":" + pad(seconds);
  }

  function getProgressPercent(book) {
    var total = Number(book.totalPages) || 0;
    var current = Number(book.currentPage) || 0;
    if (!total || !current) {
      return 0;
    }
    return Math.min(100, Math.round((current / total) * 100));
  }

  function createMetricCard(item) {
    var card = document.createElement("article");
    card.className = "dashboard-card";
    card.innerHTML = "<strong></strong><span></span><p></p>";
    card.querySelector("strong").textContent = String(item.value);
    card.querySelector("span").textContent = item.label;
    card.querySelector("p").textContent = item.detail;
    return card;
  }

  function getActiveReadingBooks() {
    return state.shelves.reading.map(function (key) {
      return state.books[key];
    }).filter(Boolean);
  }

  function getNextAction(book) {
    if (!book) {
      return {
        value: "Start",
        detail: "Move a book to Reading"
      };
    }

    var total = Number(book.totalPages) || 0;
    var current = Number(book.currentPage) || 0;
    var remaining = total ? Math.max(0, total - current) : 10;
    if (total && !remaining) {
      return {
        value: "Finish",
        detail: book.title + " is ready to complete"
      };
    }

    return {
      value: Math.min(10, remaining) + " pages",
      detail: book.title
    };
  }

  function getPagesSince(startDate) {
    var start = startOfDay(startDate).getTime();
    return state.logs.filter(function (log) {
      return getLogDate(log).getTime() >= start;
    }).reduce(sumPages, 0);
  }

  function getPagesByDate() {
    return state.logs.reduce(function (map, log) {
      var key = formatDate(getLogDate(log));
      map[key] = (map[key] || 0) + (Number(log.pages) || 0);
      return map;
    }, {});
  }

  function getCalendarLevel(pages, readOnlyMark) {
    if (pages >= 50) {
      return 3;
    }
    if (pages >= 20) {
      return 2;
    }
    if (pages > 0 || readOnlyMark) {
      return 1;
    }
    return 0;
  }

  function getReadingDayKeys() {
    var daySet = new Set(state.markedDays);
    state.logs.forEach(function (log) {
      daySet.add(formatDate(getLogDate(log)));
    });
    return Array.from(daySet).sort();
  }

  function getBestReadingDay() {
    var pagesByDate = getPagesByDate();
    return Object.keys(pagesByDate).reduce(function (best, key) {
      if (pagesByDate[key] > best.pages) {
        return {
          pages: pagesByDate[key],
          date: new Date(key + "T00:00:00")
        };
      }
      return best;
    }, { pages: 0, date: null });
  }

  function getMostActiveHour() {
    var counts = state.logs.reduce(function (map, log) {
      var hour = getLogDate(log).getHours();
      map[hour] = (map[hour] || 0) + 1;
      return map;
    }, {});
    var bestHour = Object.keys(counts).reduce(function (best, hour) {
      return counts[hour] > best.count ? { hour: Number(hour), count: counts[hour] } : best;
    }, { hour: null, count: 0 });

    return {
      label: bestHour.count ? formatHour(bestHour.hour) : "-",
      count: bestHour.count
    };
  }

  function getAveragePagesPerDay(days) {
    var cutoff = addDays(startOfDay(new Date()), -days + 1).getTime();
    var logs = state.logs.filter(function (log) {
      return getLogDate(log).getTime() >= cutoff;
    });
    var pages = logs.reduce(sumPages, 0);
    var dayCount = new Set(logs.map(function (log) {
      return formatDate(getLogDate(log));
    })).size;
    return dayCount ? Math.round(pages / dayCount) : 0;
  }

  function getFinishedBooksSince(startDate) {
    var start = startOfDay(startDate).getTime();
    return state.shelves.finished.map(function (key) {
      return state.books[key];
    }).filter(function (book) {
      if (!book || !book.finishedAt) {
        return false;
      }
      return new Date(book.finishedAt).getTime() >= start;
    }).length;
  }

  function getBookNotes(book) {
    var notes = Array.isArray(book.notes) ? book.notes.map(function (note) {
      return {
        id: note.id || "note-" + safeSlug(book.key) + "-" + safeSlug(note.text || ""),
        type: note.type || "Idea",
        text: note.text || "",
        createdAt: note.createdAt || book.noteUpdatedAt || book.addedAt || new Date().toISOString()
      };
    }).filter(function (note) {
      return note.text.trim();
    }) : [];

    if (!notes.length && book.note && book.note.trim()) {
      notes.push({
        id: "legacy-note-" + safeSlug(book.key),
        type: "Idea",
        text: book.note,
        createdAt: book.noteUpdatedAt || book.addedAt || new Date().toISOString()
      });
    }

    return notes.sort(function (a, b) {
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
  }

  function getSortedLogs() {
    return state.logs.slice().sort(function (a, b) {
      return getLogDate(b).getTime() - getLogDate(a).getTime();
    });
  }

  function getLogDate(log) {
    var fallbackDate = log.date ? log.date + "T00:00:00" : "";
    var value = log.readAt || log.createdAt || fallbackDate;
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return new Date();
    }
    return date;
  }

  function buildHistoryMeta(log) {
    var parts = [(Number(log.pages) || 0) + " pages"];
    if (Number(log.minutes)) {
      parts.push(Number(log.minutes) + " minutes");
    }
    if (log.pageAfter) {
      parts.push(log.totalPages ? "page " + log.pageAfter + " of " + log.totalPages : "page " + log.pageAfter);
    }
    return parts.join(" / ");
  }

  function sumPages(sum, log) {
    return sum + (Number(log.pages) || 0);
  }

  function sumMinutes(sum, log) {
    return sum + (Number(log.minutes) || 0);
  }

  function isWithinLastDays(date, days) {
    var now = new Date();
    var age = now.getTime() - date.getTime();
    return age >= 0 && age <= days * 24 * 60 * 60 * 1000;
  }

  function startOfDay(date) {
    var copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  function startOfWeek(date) {
    var copy = startOfDay(date);
    var mondayOffset = (copy.getDay() + 6) % 7;
    copy.setDate(copy.getDate() - mondayOffset);
    return copy;
  }

  function startOfMonth(date) {
    var copy = startOfDay(date);
    copy.setDate(1);
    return copy;
  }

  function addDays(date, days) {
    var copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  function parseDateTimeInput(value) {
    var date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) {
      return new Date();
    }
    return date;
  }

  function setDefaultLogDateTime() {
    if (!els.logDateTime.value) {
      els.logDateTime.value = toLocalDateTimeInputValue(new Date());
    }
  }

  function toLocalDateTimeInputValue(date) {
    return [
      date.getFullYear(),
      "-",
      pad(date.getMonth() + 1),
      "-",
      pad(date.getDate()),
      "T",
      pad(date.getHours()),
      ":",
      pad(date.getMinutes())
    ].join("");
  }

  function formatDisplayDateTime(date) {
    return new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "short",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  function formatShortDate(date) {
    return new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "short"
    }).format(date);
  }

  function formatLongDate(date) {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short"
    }).format(date);
  }

  function formatHour(hour) {
    var date = new Date();
    date.setHours(hour, 0, 0, 0);
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric"
    }).format(date);
  }

  function emptyState(text) {
    return '<div class="empty-state">' + escapeHtml(text) + "</div>";
  }

  function clampNumber(value, min, max) {
    var number = Math.round(Number(value));
    if (!Number.isFinite(number)) {
      return 0;
    }
    return Math.max(min, Math.min(max, number));
  }

  function todayString() {
    return formatDate(new Date());
  }

  function formatDate(date) {
    var year = date.getFullYear();
    var month = pad(date.getMonth() + 1);
    var day = pad(date.getDate());
    return year + "-" + month + "-" + day;
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function safeSlug(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  function sanitizeUsername(value) {
    return String(value)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 40);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
  }
})();
