/* ============================================
   LEARN WITH SAURAB - Weakness Analyzer Pro
   ============================================ */

function openManualModal() {
  document.getElementById('manualModal').style.display = 'flex';
}

function closeManualModal() {
  document.getElementById('manualModal').style.display = 'none';
}

async function markMastered(id) {
  const btn = event.target.closest('.btn-master');
  if (!btn) return;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  try {
    const res = await fetch('/mistake-notebook/' + id + '/mastered', { method: 'PUT' });
    const data = await res.json();
    if (data.success) {
      const card = document.getElementById('mistake-' + id);
      if (card) {
        card.classList.add('mastered');
        card.style.opacity = '0.5';
        btn.innerHTML = '<i class="fas fa-check-circle"></i> Mastered!';
        btn.style.background = 'rgba(16,185,129,0.2)';
        btn.style.color = '#10B981';
        setTimeout(() => { card.style.display = 'none'; }, 2000);
      }
    }
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check"></i> Mark Mastered';
    alert('Error. Please try again.');
  }
}

let notesTimeout = {};
function saveNotes(id, text) {
  clearTimeout(notesTimeout[id]);
  notesTimeout[id] = setTimeout(async () => {
    try {
      await fetch('/mistake-notebook/' + id + '/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: text })
      });
    } catch (err) {}
  }, 1500);
}

async function generateMasterQuiz() {
  const btn = event.target;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating Quiz...';

  try {
    const res = await fetch('/mistake-notebook/quiz');
    const data = await res.json();
    if (data.success && data.quiz.length > 0) {
      showQuizModal(data.quiz);
    } else {
      alert(data.message || 'No mistakes to quiz on! Add some weaknesses first.');
    }
  } catch (err) {
    alert('Error generating quiz.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-brain"></i> Generate "Master This" Quiz';
  }
}

function showQuizModal(quiz) {
  let currentQ = 0;
  let score = 0;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'quizModal';

  function renderQ() {
    const q = quiz[currentQ];
    const hasOptions = q.options && q.options.length > 0;
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3><i class="fas fa-brain"></i> Master Quiz — ${currentQ + 1}/${quiz.length}</h3>
          <button onclick="document.getElementById('quizModal').remove()"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom:16px">
            <span class="badge-topic">${q.topic || 'General'}</span>
            <span class="badge-diff diff-${(q.difficulty||'medium').toLowerCase()}" style="margin-left:8px">${q.difficulty||'Medium'}</span>
          </div>
          <p style="font-size:16px;font-weight:600;line-height:1.5;margin-bottom:20px">${q.questionText}</p>
          ${hasOptions ? `<div class="options-grid quiz-options">
            ${q.options.map((opt, i) => `<button class="option-btn" onclick="selectQuizOpt(this, ${i}, ${q._id ? "'" + q._id + "'" : 'null'})">
              <span class="option-letter-btn">${['A','B','C','D'][i]}</span>${opt.text}
            </button>`).join('')}
          </div>` : `<p style="color:#6B7280">No options tracked for this entry.</p>`}
          <div id="quizFeedback" style="display:none"></div>
        </div>
        <div class="modal-actions">
          <span style="color:#6B7280;font-size:14px">Score: <strong>${score}/${currentQ}</strong></span>
          ${currentQ > 0 ? '' : ''}
          <button class="btn-secondary" onclick="${currentQ < quiz.length - 1 ? 'nextQuizQ()' : 'finishQuiz(' + score + ',' + quiz.length + ')'}">
            ${currentQ < quiz.length - 1 ? 'Skip →' : 'Finish'}
          </button>
        </div>
      </div>`;
  }

  window.selectQuizOpt = function(btn, idx, id) {
    const q = quiz[currentQ];
    const correctIdx = q.options ? q.options.findIndex(o => o.isCorrect) : -1;
    document.querySelectorAll('.quiz-options .option-btn').forEach(b => b.disabled = true);
    if (idx === correctIdx) {
      score++;
      btn.classList.add('selected');
      btn.style.borderColor = '#10B981';
      btn.style.color = '#10B981';
      btn.style.background = 'rgba(16,185,129,0.1)';
      document.getElementById('quizFeedback').innerHTML = '<div class="alert alert-success" style="display:flex;margin-top:12px"><i class="fas fa-check-circle"></i> Correct!</div>';
    } else {
      btn.style.borderColor = '#EF4444';
      btn.style.color = '#EF4444';
      btn.style.background = 'rgba(239,68,68,0.08)';
      if (correctIdx >= 0) {
        document.querySelectorAll('.quiz-options .option-btn')[correctIdx].style.borderColor = '#10B981';
        document.querySelectorAll('.quiz-options .option-btn')[correctIdx].style.background = 'rgba(16,185,129,0.1)';
      }
      document.getElementById('quizFeedback').innerHTML = '<div class="alert alert-error" style="display:flex;margin-top:12px"><i class="fas fa-times-circle"></i> Wrong! Review this topic again.</div>';
    }
    document.getElementById('quizFeedback').style.display = 'block';
  };

  window.nextQuizQ = function() {
    currentQ++;
    renderQ();
  };

  window.finishQuiz = function(sc, total) {
    const pct = Math.round((sc / total) * 100);
    overlay.querySelector('.modal-body').innerHTML = `
      <div style="text-align:center;padding:24px">
        <div style="font-size:64px;margin-bottom:16px">${pct >= 70 ? '🎉' : '📚'}</div>
        <h2 style="font-family:Montserrat,sans-serif;font-size:28px;margin-bottom:8px">${sc}/${total} Correct</h2>
        <p style="color:#6B7280">${pct}% — ${pct >= 80 ? 'Excellent! You\'re mastering your weaknesses!' : pct >= 60 ? 'Good progress! Keep reviewing.' : 'Keep practicing. You\'ve got this!'}</p>
        <div style="width:100%;height:8px;background:rgba(255,255,255,0.08);border-radius:4px;margin:20px 0;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#00D4FF,#7C3AED);border-radius:4px;transition:width 1s ease"></div>
        </div>
      </div>`;
    overlay.querySelector('.modal-actions').innerHTML = `
      <a href="/mistake-notebook" class="btn-secondary">Back to Notebook</a>
      <button class="btn-auth" onclick="document.getElementById('quizModal').remove()">Close</button>`;
  };

  renderQ();
  document.body.appendChild(overlay);
}

// Manual form submission
const manualForm = document.getElementById('manualForm');
if (manualForm) {
  manualForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const formData = new FormData(manualForm);
    const data = Object.fromEntries(formData.entries());
    try {
      const res = await fetch('/mistake-notebook/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (result.success) {
        closeManualModal();
        location.reload();
      } else {
        alert(result.message || 'Error adding entry.');
      }
    } catch (err) {
      alert('Error. Please try again.');
    }
  });
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function(e) {
    if (e.target === this) this.style.display = 'none';
  });
});
