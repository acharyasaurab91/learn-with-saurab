/* ============================================
   LEARN WITH SAURAB - Test Engine + Timer
   ============================================ */

let currentQuestion = 0;
const answers = [];
const markedForReview = new Set();
const questions = TEST_DATA.questions;

// Initialize answers array
for (let i = 0; i < questions.length; i++) {
  answers.push({ questionId: questions[i]._id, selectedOption: -1 });
}

// ---- Refresh persistence (per-test keys) ----
const END_KEY = 'test-' + TEST_DATA.testId + '-endTime';
const STATE_KEY = 'test-' + TEST_DATA.testId + '-state';
try {
  const saved = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null');
  if (saved) {
    (saved.answers || []).forEach(a => {
      const i = questions.findIndex(q => q._id === a.questionId);
      if (i >= 0 && typeof a.selectedOption === 'number') answers[i].selectedOption = a.selectedOption;
    });
    (saved.marked || []).forEach(i => { if (i >= 0 && i < questions.length) markedForReview.add(i); });
    if (typeof saved.current === 'number' && saved.current >= 0 && saved.current < questions.length) {
      currentQuestion = saved.current;
    }
  }
} catch (e) { /* ignore corrupt state */ }

function persistState() {
  try {
    sessionStorage.setItem(STATE_KEY, JSON.stringify({
      answers: answers.map(a => ({ questionId: a.questionId, selectedOption: a.selectedOption })),
      marked: [...markedForReview],
      current: currentQuestion
    }));
  } catch (e) { /* storage full/unavailable */ }
}

// ---- Timer (persists across refresh via sessionStorage endTime) ----
let endTime = parseInt(sessionStorage.getItem(END_KEY), 10);
if (!endTime || Number.isNaN(endTime)) {
  endTime = Date.now() + TEST_DATA.duration * 60 * 1000;
  try { sessionStorage.setItem(END_KEY, String(endTime)); } catch (e) {}
}
let timeLeft = Math.max(0, Math.round((endTime - Date.now()) / 1000));
const timerEl = document.getElementById('timerDisplay');
const timerContainer = document.querySelector('.test-timer');

function updateTimer() {
  timeLeft = Math.max(0, Math.round((endTime - Date.now()) / 1000));
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  timerEl.textContent = m + ':' + String(s).padStart(2, '0');

  // teal > 5 min · amber 2–5 min · red < 2 min
  if (timeLeft <= 300) {
    timerContainer.classList.add('warning');
    timerContainer.classList.remove('danger');
  }
  if (timeLeft <= 120) {
    timerContainer.classList.add('danger');
    timerContainer.classList.remove('warning');
  }
  if (timeLeft === 0) {
    clearInterval(timerInterval);
    submitTest();
    return;
  }
}

const timerInterval = setInterval(updateTimer, 1000);
updateTimer();

// ---- Question Rendering ----
function renderQuestion(idx) {
  currentQuestion = idx;
  const q = questions[idx];

  document.getElementById('qNum').textContent = 'Q' + (idx + 1);
  document.getElementById('qText').textContent = q.questionText;
  document.getElementById('qProgress').textContent = 'Question ' + (idx + 1) + ' of ' + questions.length;

  const pct = ((idx + 1) / questions.length) * 100;
  document.getElementById('qProgressBar').style.width = pct + '%';

  const imgWrap = document.getElementById('qImgWrap');
  const qImg = document.getElementById('qImg');
  if (q.questionImage) {
    qImg.src = q.questionImage;
    imgWrap.style.display = 'block';
  } else {
    imgWrap.style.display = 'none';
  }

  const optionsGrid = document.getElementById('optionsGrid');
  optionsGrid.innerHTML = '';
  q.options.forEach((opt, optIdx) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn' + (answers[idx].selectedOption === optIdx ? ' selected' : '');
    // Safe rendering: question/option content goes through textContent only
    const letter = document.createElement('span');
    letter.className = 'option-letter-btn';
    letter.textContent = ['A', 'B', 'C', 'D'][optIdx] || String(optIdx + 1);
    const label = document.createElement('span');
    label.textContent = opt.text || '';
    btn.appendChild(letter);
    btn.appendChild(label);
    btn.addEventListener('click', () => selectOption(idx, optIdx));
    optionsGrid.appendChild(btn);
  });

  document.getElementById('prevBtn').disabled = idx === 0;
  document.getElementById('nextBtn').textContent = idx === questions.length - 1 ? 'Finish' : 'Next';
  document.getElementById('nextBtn').innerHTML = idx === questions.length - 1 ?
    'Finish <i class="fas fa-flag-checkered"></i>' :
    'Next <i class="fas fa-arrow-right"></i>';

  const markBtn = document.getElementById('markBtn');
  markBtn.classList.toggle('marked', markedForReview.has(idx));

  updateGridBtn(idx);
  updateCurrentGrid();
  persistState();
}

function selectOption(qIdx, optIdx) {
  answers[qIdx].selectedOption = optIdx;
  markedForReview.delete(qIdx);
  renderQuestion(qIdx);
  updateSummary();
}

function nextQuestion() {
  if (currentQuestion < questions.length - 1) {
    renderQuestion(currentQuestion + 1);
  } else {
    confirmSubmit();
  }
}

function prevQuestion() {
  if (currentQuestion > 0) renderQuestion(currentQuestion - 1);
}

function goToQuestion(idx) {
  renderQuestion(idx);
}

function markForReview() {
  if (markedForReview.has(currentQuestion)) {
    markedForReview.delete(currentQuestion);
  } else {
    markedForReview.add(currentQuestion);
  }
  renderQuestion(currentQuestion);
  updateGridBtn(currentQuestion);
  updateSummary();
}

function updateGridBtn(idx) {
  const btn = document.getElementById('qgrid-' + idx);
  if (!btn) return;
  btn.className = 'qgrid-btn';
  if (idx === currentQuestion) btn.classList.add('current');
  if (markedForReview.has(idx)) btn.classList.add('review');
  else if (answers[idx].selectedOption !== -1) btn.classList.add('answered');
}

function updateCurrentGrid() {
  for (let i = 0; i < questions.length; i++) updateGridBtn(i);
}

function updateSummary() {
  const answered = answers.filter(a => a.selectedOption !== -1).length;
  const unanswered = questions.length - answered;
  document.getElementById('answeredCount').textContent = answered;
  document.getElementById('unansweredCount').textContent = unanswered;
  document.getElementById('reviewCount').textContent = markedForReview.size;
  const pill = document.getElementById('headerAnswered');
  if (pill) pill.textContent = 'Answered ' + answered + '/' + questions.length;
}

function confirmSubmit() {
  const total = questions.length;
  const answered = answers.filter(a => a.selectedOption !== -1).length;
  document.getElementById('modalTotal').textContent = total;
  document.getElementById('modalAnswered').textContent = answered;
  document.getElementById('modalUnanswered').textContent = total - answered;
  document.getElementById('modalMarked').textContent = markedForReview.size;
  const reviewWarn = document.getElementById('reviewWarning');
  if (markedForReview.size > 0) {
    reviewWarn.textContent = '⚠️ ' + markedForReview.size + ' question(s) marked for review.';
  }
  document.getElementById('submitModal').style.display = 'flex';
}

function closeSubmitModal() {
  document.getElementById('submitModal').style.display = 'none';
}

async function submitTest() {
  clearInterval(timerInterval);
  closeSubmitModal();
  const timeTaken = Math.max(0, Math.floor((TEST_DATA.duration * 60 * 1000 - (endTime - Date.now())) / 1000));

  const submitBtn = document.querySelector('.btn-submit-test');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
  }

  try {
    const res = await fetch('/tests/' + TEST_DATA.testId + '/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: JSON.stringify(answers), timeTaken })
    });
    const data = await res.json();
    if (data.success) {
      try { sessionStorage.removeItem(END_KEY); sessionStorage.removeItem(STATE_KEY); } catch (e) {}
      window.location.href = '/tests/result/' + data.attemptId;
    } else {
      alert('Submission failed: ' + data.message);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Test';
      }
    }
  } catch (err) {
    alert('Network error. Please try again.');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Test';
    }
  }
}

// Handle page leave warning
window.addEventListener('beforeunload', e => {
  const answered = answers.filter(a => a.selectedOption !== -1).length;
  if (answered > 0 && timeLeft > 0) {
    e.preventDefault();
    e.returnValue = 'You have an ongoing test. Are you sure you want to leave?';
    return e.returnValue;
  }
});

// Start (resume at the restored question, if any)
renderQuestion(currentQuestion);
updateSummary();

// Optional: discourage browser-back mid-test (beforeunload already warns)
try {
  history.pushState(null, '', location.href);
  window.addEventListener('popstate', () => history.pushState(null, '', location.href));
} catch (e) {}
