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

// ---- Timer ----
let timeLeft = TEST_DATA.duration * 60;
let startTime = Date.now();
const timerEl = document.getElementById('timerDisplay');
const timerContainer = document.querySelector('.test-timer');

function updateTimer() {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  timeLeft = Math.max(0, TEST_DATA.duration * 60 - elapsed);
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  timerEl.textContent = m + ':' + String(s).padStart(2, '0');

  if (timeLeft <= 300) {
    timerContainer.classList.add('warning');
    timerContainer.classList.remove('danger');
  }
  if (timeLeft <= 60) {
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
    btn.innerHTML = `<span class="option-letter-btn">${['A','B','C','D'][optIdx]}</span>${opt.text}`;
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
}

function confirmSubmit() {
  const answered = answers.filter(a => a.selectedOption !== -1).length;
  document.getElementById('modalAnswered').textContent = answered;
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
  const timeTaken = Math.floor((Date.now() - startTime) / 1000);

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

// Start
renderQuestion(0);
updateSummary();
