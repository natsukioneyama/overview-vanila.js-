(function () {
  'use strict';

  const container = document.getElementById('grid');
  if (!container) return;

  // HTML に直書きした figure から、比率だけを取り出す
  const itemElements = Array.from(container.querySelectorAll('.jl-item'));
  const items = itemElements.map(el => {
    const w = Number(el.dataset.w) || 1;
    const h = Number(el.dataset.h) || 1;
    return {
      el,
      aspectRatio: w / h
    };
  });

  function render() {
    const jl = window.justifiedLayout;
    if (!jl) {
      console.error('justifiedLayout が見つかりません');
      return;
    }

    const containerWidth = container.clientWidth;
    if (!containerWidth) return;

    // justified-layout に比率だけ渡す
    const layout = jl(
      items.map(i => ({ aspectRatio: i.aspectRatio })),
      {
        containerWidth,
        targetRowHeight: 140, // 行の“理想高さ” – 好きに調整してOK
        boxSpacing: 15
      }
    );

    // コンテナ高さ
    container.style.height = layout.containerHeight + 'px';

    // 各 box を DOM に反映
    layout.boxes.forEach((box, index) => {
      const it = items[index];
      const el = it.el;

      el.style.transform = `translate(${box.left}px, ${box.top}px)`;
      el.style.width  = box.width + 'px';
      el.style.height = box.height + 'px';
    });

        // レイアウト完了後に動画を自動再生
    const videos = container.querySelectorAll('video');
    videos.forEach(v => {
      v.muted = true;
      v.playsInline = true;
      v.loop = true;

      const p = v.play();
      if (p && p.catch) {
        p.catch(() => {}); // Safari の再生制限エラーを防ぐ
      }
    });
  }

  // 初回 & リサイズ
  window.addEventListener('load', render);
  window.addEventListener('resize', render);


  // ★ ここから追加：フルスクリーンボタンの処理
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.fs-btn');
    if (!btn) return;

    // ボタンが属している video figure を探す
    const fig = btn.closest('.jl-item.is-video');
    if (!fig) return;

    const video = fig.querySelector('video');
    if (!video) return;

    // フルスクリーン API（ブラウザごとに分岐）
    if (video.requestFullscreen) {
      video.requestFullscreen();
    } else if (video.webkitRequestFullscreen) { // Safari
      video.webkitRequestFullscreen();
    } else if (video.msRequestFullscreen) {     // 古いEdge
      video.msRequestFullscreen();
    }

    // 全画面に入ったら確実に再生
    const p = video.play();
    if (p && p.catch) {
      p.catch(() => {});
    }
  });
  // ★ 追加ここまで

})(); // ← IIFE の閉じかっこ

















/* ========== Lightbox (gm) ========== */
document.addEventListener('DOMContentLoaded', () => {
  const gm      = document.getElementById('gm');
  const gmFrame = gm.querySelector('.gm-frame');
  const gmImg   = gm.querySelector('#gmImage');
  const gmVWrap = gm.querySelector('.gm-video-wrap');
  const gmVideo = gm.querySelector('#gmVideo');

  const gmTitle = gm.querySelector('.gm-ttl');
  const gmSub   = gm.querySelector('.gm-sub');
  const gmCount = gm.querySelector('.gm-counter');

  const gmClose = gm.querySelector('.gm-close');
  const gmPrev  = gm.querySelector('.gm-prev');
  const gmNext  = gm.querySelector('.gm-next');
  const gmBg    = gm.querySelector('.gm-backdrop');

  const items = Array.from(document.querySelectorAll('#grid .jl-item'));
  let currentIndex = 0;

  function openAt(index) {
    currentIndex = (index + items.length) % items.length;
    const item   = items[currentIndex];
    const img    = item.querySelector('img');
    const meta   = item.querySelector('.lb-data');

    // まず全てリセット
    gmImg.src = '';
    gmImg.classList.remove('ready');
    gmImg.hidden = false;

    gmVideo.pause();
    gmVideo.removeAttribute('src');
    gmVideo.currentTime = 0;
    gmVideo.hidden = true;
    gmVWrap.hidden = true;

    if (meta && meta.dataset.type === 'video') {
      showVideo(meta);
    } else if (img) {
      showImage(img);
    }

    updateCaption(img, meta);
    updateCounter();

    gm.setAttribute('aria-hidden', 'false');
  }

  function showImage(img) {
    const full = img.dataset.full || img.src;
    const preload = new Image();
    preload.src = full;

    preload.onload = () => {
      gmImg.src = full;
      gmImg.hidden = false;
      gmImg.classList.add('ready');
    };

    // 念のためエラー時も表示だけはする
    preload.onerror = () => {
      gmImg.src = full;
      gmImg.hidden = false;
      gmImg.classList.add('ready');
    };
  }

  // サムネをクリックしたときに呼ばれる：動画を自動再生＋ループ
  function showVideo(meta) {
    const src = meta.dataset.full;
    if (!src) return;

    // 静止画を隠して動画ラッパーを表示
    gmImg.hidden = true;
    gmImg.classList.remove('ready');

    gmVWrap.hidden = false;
    gmVideo.hidden = false;

    // ループ ON
    gmVideo.loop = true;

    // ソースをセット（同じ src なら無駄に立ち上げない）
    if (gmVideo.src !== src) {
      gmVideo.src = src;
    }

    // 毎回頭から再生
    gmVideo.currentTime = 0;

    // 自動再生（ミュート＋playsinline なら Safari でも通るはず）
    const p = gmVideo.play();
    if (p && p.then) {
      p.catch(() => {
        // ブロックされた場合でも UI はそのまま（ユーザーが PLAY を押せる）
      });
    }
  }



  function updateCaption(img, meta) {
    // 画像の data-* を優先、なければ .lb-data の data-* を使う
    const t  = (img && img.dataset.title) || (meta && meta.dataset.title) || '';
    const l1 = (img && img.dataset.line1) || (meta && meta.dataset.line1) || '';
    const l2 = (img && img.dataset.line2) || (meta && meta.dataset.line2) || '';

    gmTitle.textContent = t;
    gmSub.textContent   = [l1, l2].filter(Boolean).join(' / ');
  }

  function updateCounter() {
    gmCount.textContent = `${currentIndex + 1} / ${items.length}`;
  }

  function closeModal() {
    gm.setAttribute('aria-hidden', 'true');

    gmImg.src = '';
    gmImg.classList.remove('ready');
    gmImg.hidden = false;

    gmVideo.pause();
    gmVideo.removeAttribute('src');
    gmVideo.currentTime = 0;
    gmVideo.hidden = true;
    gmVWrap.hidden = true;
  }

  // サムネクリック → Lightbox オープン
  items.forEach((item, index) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      openAt(index);
    });
  });

  // ナビゲーション
  gmPrev.addEventListener('click', (e) => {
    e.stopPropagation();
    openAt(currentIndex - 1);
  });

  gmNext.addEventListener('click', (e) => {
    e.stopPropagation();
    openAt(currentIndex + 1);
  });

  // 閉じる
  gmClose.addEventListener('click', (e) => {
    e.stopPropagation();
    closeModal();
  });

  gmBg.addEventListener('click', () => {
    closeModal();
  });

  // ESC キーで閉じる
    // キーボード操作（Lightbox が開いているときだけ有効）
  window.addEventListener('keydown', (e) => {
    // 閉じているときは何もしない
    if (gm.getAttribute('aria-hidden') === 'true') return;

    if (e.key === 'Escape') {
      // ESC → 閉じる
      e.preventDefault();
      closeModal();
    } else if (e.key === 'ArrowRight') {
      // → キー → 次へ
      e.preventDefault();
      openAt(currentIndex + 1);
    } else if (e.key === 'ArrowLeft') {
      // ← キー → 前へ
      e.preventDefault();
      openAt(currentIndex - 1);
    }
  });

  // スワイプ操作（スマホ用：左右スワイプで前後）
  let touchStartX = 0;
  let touchStartY = 0;

  // 開いているときだけ、gm 全体でスワイプを検知
  gm.addEventListener('touchstart', (e) => {
    if (gm.getAttribute('aria-hidden') === 'true') return;
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  }, { passive: true });

  gm.addEventListener('touchend', (e) => {
    if (gm.getAttribute('aria-hidden') === 'true') return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;

    const minDist = 50;  // 必要な横方向移動量（px）
    const maxVert = 40;  // 縦方向ブレはこの範囲まで許容

    // 横方向に一定以上スワイプ＋縦ブレ少なめ → ページ送り
    if (Math.abs(dx) > minDist && Math.abs(dy) < maxVert) {
      e.preventDefault();
      if (dx < 0) {
        // 左にスワイプ → 次の画像 / 動画
        openAt(currentIndex + 1);
      } else {
        // 右にスワイプ → 前の画像 / 動画
        openAt(currentIndex - 1);
      }
    }
  }, { passive: false });
});














/* ========== Video custom UI (sv-controls) ========== */
document.addEventListener('DOMContentLoaded', () => {
  const gm    = document.getElementById('gm');
  const video = document.getElementById('gmVideo');
  const ctrls = gm ? gm.querySelector('.sv-controls') : null;

  if (!gm || !video || !ctrls) return;

  const progress = ctrls.querySelector('.sv-progress');
  const bar      = ctrls.querySelector('.sv-progress__bar');
  const btnPlay  = ctrls.querySelector('.sv-btn--play');
  const btnFs    = ctrls.querySelector('.sv-btn--fs');



  // ---- 再生ボタンの表示を同期 ----
  function syncPlayButton() {
    if (!btnPlay) return;
    btnPlay.textContent = video.paused ? 'PLAY' : 'PAUSE';
  }

    // ---- プログレス更新 ----
  function updateProgress() {
    if (!video.duration || !isFinite(video.duration)) {
      if (bar) bar.style.transform = 'scaleX(0)';
      return;
    }
    const ratio = video.currentTime / video.duration;
    const clamped = Math.max(0, Math.min(1, ratio || 0));
    if (bar) {
      bar.style.transform = `scaleX(${clamped})`;
    }
  }

  video.addEventListener('timeupdate',       updateProgress);
  video.addEventListener('loadedmetadata',   updateProgress);
  video.addEventListener('play',  syncPlayButton);
  video.addEventListener('pause', syncPlayButton);

  // ---- 共通の seek 関数（マウス / タッチ / ペン用）----
  function seekFromClientX(clientX) {
    if (!progress || !video.duration || !isFinite(video.duration)) return;

    const rect = progress.getBoundingClientRect();
    let ratio = (clientX - rect.left) / rect.width;
    ratio = Math.max(0, Math.min(1, ratio));

    video.currentTime = ratio * video.duration;
    updateProgress();
  }

  let isScrubbing = false;

  if (progress) {
    // pointer 系でまとめて対応（PC / iPhone / iPad 共通）
    progress.addEventListener('pointerdown', (e) => {
      isScrubbing = true;
      progress.setPointerCapture(e.pointerId);
      seekFromClientX(e.clientX);
    });

    progress.addEventListener('pointermove', (e) => {
      if (!isScrubbing) return;
      seekFromClientX(e.clientX);
    });

    progress.addEventListener('pointerup', (e) => {
      if (!isScrubbing) return;
      isScrubbing = false;
      progress.releasePointerCapture(e.pointerId);
      syncPlayButton();
    });

    progress.addEventListener('pointercancel', () => {
      isScrubbing = false;
    });
  }



  // ---- 再生 / 一時停止 ----
  if (btnPlay) {
    btnPlay.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }

  // ---- フルスクリーン ----
    // ---- FULLSCREEN トグル ----
  if (btnFs) {
    btnFs.addEventListener('click', () => {
      if (!video) return;

      const doc = document;
      const el  = video;

      const isFs =
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        el.webkitDisplayingFullscreen;

      if (isFs) {
        // すでにフルスクリーン → 抜ける
        if (doc.exitFullscreen) {
          doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          doc.msExitFullscreen();
        }
      } else {
        // これからフルスクリーンに入る
        if (el.requestFullscreen) {
          el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
          el.webkitRequestFullscreen();
        } else if (el.webkitEnterFullscreen) {
          // iOS Safari 向け
          el.webkitEnterFullscreen();
        } else if (el.webkitEnterFullScreen) {
          // 古い iOS Safari 向けの別名
          el.webkitEnterFullScreen();
        }
      }
    });
  }


  // 初期状態の表示
  syncPlayButton();
  updateProgress();
});
