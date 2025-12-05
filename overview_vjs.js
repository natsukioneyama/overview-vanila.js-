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
        targetRowHeight: 150, // 行の“理想高さ” – 好きに調整してOK
        boxSpacing: 8
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

        document.body.classList.add('jl-ready');
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
    const imgCache = new Map(); // full src -> { image, promise }

  // ---- フルサイズ画像をプリロード＆キャッシュ ----
  function preloadFullImage(full) {
    if (!full) return null;

    // すでにキャッシュ済みならそれを返す
    let record = imgCache.get(full);
    if (record) return record;

    const image = new Image();
    image.src = full;

    let promise;
    if (image.decode) {
      // decode 対応ブラウザ（Safari も OK）
      promise = image.decode().catch(() => {});
    } else {
      // 古いブラウザ用フォールバック
      promise = new Promise((resolve) => {
        image.onload  = () => resolve();
        image.onerror = () => resolve();
      });
    }

    record = { image, promise };
    imgCache.set(full, record);
    return record;
  }

  // ---- 前後の画像をプリロード（常に先読み）----
  function preloadAround(index) {
    const targets = [index + 1, index - 1, index + 2, index - 2];

    targets.forEach((i) => {
      const safeIndex = (i + items.length) % items.length;
      const item = items[safeIndex];
      if (!item || item.classList.contains('is-video')) return;

      const img = item.querySelector('img');
      if (!img) return;

      const full = img.dataset.full || img.src;
      preloadFullImage(full);
    });
  }

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
   
    preloadAround(currentIndex);
    gm.setAttribute('aria-hidden', 'false');
  }

  function showImage(img) {
    const full = img.dataset.full || img.src;

    // まずプリロード（キャッシュ取得）
    const record = preloadFullImage(full);
    const apply = () => {
      gmImg.src = full;
      gmImg.hidden = false;
      gmImg.classList.add('ready');
    };

    if (record && record.promise) {
      // すでにロード中 or これからロード → decode 完了後に表示
      record.promise.then(apply);
    } else {
      // 何らかの理由で record が無い時のフォールバック
      apply();
    }
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
  let touchOnControls = false; // ★ 動画コントロール上のタッチかどうか

  gm.addEventListener('touchstart', (e) => {
    if (gm.getAttribute('aria-hidden') === 'true') return;

    const t = e.touches[0];
    if (!t) return;

    // ★ 追加：動画コントロールや動画ラッパー上ならスワイプ無効
    const target = e.target;
    if (
      target.closest('.gm-video-wrap') || // 動画エリア全体
      target.closest('.sv-controls')      // カスタムコントロール
    ) {
      touchOnControls = true;
      return;
    }

    touchOnControls = false;
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  }, { passive: true });

  gm.addEventListener('touchend', (e) => {
    if (gm.getAttribute('aria-hidden') === 'true') return;

    // ★ コントロール上で始まったタッチはここで終了
    if (touchOnControls) {
      touchOnControls = false;
      return;
    }

    const t = e.changedTouches[0];
    if (!t) return;

    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;

    const minDist = 50;  // 必要な横方向移動量（px）
    const maxVert = 40;  // 縦方向ブレ許容量

    if (Math.abs(dx) > minDist && Math.abs(dy) < maxVert) {
      e.preventDefault();
      if (dx < 0) {
        // 左にスワイプ → 次
        openAt(currentIndex + 1);
      } else {
        // 右にスワイプ → 前
        openAt(currentIndex - 1);
      }
    }
  }, { passive: false });

});







// ==== Simple Viewer: open (画像 or 動画 or HTML snippet) ====
(function () {
  const sv = document.getElementById('simple-viewer');
  if (!sv) return;

  const svImg  = sv.querySelector('.simple-viewer__img');
  const svText = sv.querySelector('.simple-viewer__text');

  const svVideoWrap = sv.querySelector('.sv-video');
  const svVideoTag  = sv.querySelector('.sv-video__tag');
  const svControls  = sv.querySelector('.sv-video__controls');
  const svProgTrack = svControls ? svControls.querySelector('.sv-progress') : null;
  const svProgBar   = svControls ? svControls.querySelector('.sv-progress__bar') : null;
  const svPlayBtn   = svControls ? svControls.querySelector('.sv-btn--play') : null;
  const svFsBtn     = svControls ? svControls.querySelector('.sv-btn--fs') : null;

  // ==== プログレス関連 ====
  let isSeeking        = false;
  let hideControlsTimer = null;

  function resetControls() {
    if (svProgBar) {
      svProgBar.style.width = '0%';
    }
    if (svPlayBtn && svVideoTag) {
      svPlayBtn.textContent = svVideoTag.paused ? 'PLAY' : 'PAUSE';
    }
    if (svControls) {
      svControls.classList.remove('is-visible');
    }
    if (hideControlsTimer) {
      clearTimeout(hideControlsTimer);
      hideControlsTimer = null;
    }
  }

  function updateProgress() {
    if (!svVideoTag || !svProgBar) return;
    if (!svVideoTag.duration || !isFinite(svVideoTag.duration)) {
      svProgBar.style.width = '0%';
      return;
    }
    const ratio = svVideoTag.currentTime / svVideoTag.duration;
    svProgBar.style.width = `${ratio * 100}%`;
  }

  function seekFromClientX(clientX) {
    if (!svProgTrack || !svVideoTag || !svVideoTag.duration) return;

    const rect = svProgTrack.getBoundingClientRect();
    if (!rect.width) return;

    let ratio = (clientX - rect.left) / rect.width;
    if (ratio < 0) ratio = 0;
    if (ratio > 1) ratio = 1;

    svVideoTag.currentTime = ratio * svVideoTag.duration;
  }

  // ==== プログレスバーでシーク ====
  if (svProgTrack && svVideoTag) {
    const onPointerMove = (e) => {
      if (!isSeeking) return;
      e.preventDefault();
      seekFromClientX(e.clientX);
    };

    const onPointerUp = (e) => {
      if (!isSeeking) return;
      isSeeking = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    svProgTrack.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();    // 背景クリック扱いにしない
      isSeeking = true;
      seekFromClientX(e.clientX);

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });
  }

  // ==== 再生 / 一時停止 ====
  function syncPlayButton() {
    if (!svPlayBtn || !svVideoTag) return;
    svPlayBtn.textContent = svVideoTag.paused ? 'PLAY' : 'PAUSE';
  }

  if (svPlayBtn && svVideoTag) {
    svPlayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (svVideoTag.paused) {
        svVideoTag.play().catch(() => {});
      } else {
        svVideoTag.pause();
      }
      syncPlayButton();
    });
  }

  // ==== フルスクリーン ====
  if (svFsBtn && svVideoTag) {
    svFsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (svVideoTag.requestFullscreen) {
        svVideoTag.requestFullscreen();
      } else if (svVideoTag.webkitEnterFullscreen) {
        svVideoTag.webkitEnterFullscreen();
      }
    });
  }

  // 再生中は progress 更新 + ボタン表示同期
  if (svVideoTag) {
    svVideoTag.addEventListener('timeupdate', updateProgress);
    svVideoTag.addEventListener('play', syncPlayButton);
    svVideoTag.addEventListener('pause', syncPlayButton);
  }

  // ==== コントロール表示（iPhone 向け） ====
  function showControls() {
    if (!svControls) return;
    svControls.classList.add('is-visible');

    if (hideControlsTimer) clearTimeout(hideControlsTimer);
    hideControlsTimer = setTimeout(() => {
      svControls.classList.remove('is-visible');
      hideControlsTimer = null;
    }, 3000);
  }

  // 「タッチデバイスのみ」タップで表示
  if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
    if (svVideoWrap) {
      svVideoWrap.addEventListener('click', (e) => {
        // まずコントロール表示（動画タップ）
        showControls();
      });
    }

    if (svControls) {
      svControls.addEventListener('pointerdown', () => {
        if (hideControlsTimer) clearTimeout(hideControlsTimer);
      });
      svControls.addEventListener('pointerup', () => {
        showControls();
      });
    }
  }

  // ==== Simple Viewer アイコンから開く処理 ====
  const svButtons = document.querySelectorAll('.icon[data-type="simple-view"]');

  const openSimpleViewer = (btn, e) => {
    e.preventDefault();
    e.stopPropagation();

    const src = btn.dataset.src || '';
    if (!src) return;

    const isVideo = /\.(mp4|webm|mov)(\?.*)?$/i.test(src);
    const isImage = /\.(webp|jpg|jpeg|png|gif|avif)(\?.*)?$/i.test(src);
    const isHtml  = /\.html?(\?.*)?$/i.test(src);

    sv.classList.add('open');

    // 全ビューをリセット
    if (svVideoWrap) {
      svVideoWrap.style.display = 'none';
    }
    if (svImg) {
      svImg.style.display = 'none';
      svImg.removeAttribute('src');
    }
    if (svText) {
      svText.style.display = 'none';
      svText.innerHTML = '';
    }

    // 動画
    if (isVideo && svVideoWrap && svVideoTag) {
      svVideoWrap.style.display = 'inline-block';

      // コントロール初期化
      resetControls();

      // 動画属性
      svVideoTag.src        = src;
      svVideoTag.loop       = true;
      svVideoTag.muted      = true;
      svVideoTag.playsInline = true;
      svVideoTag.currentTime = 0;

      // メタデータ読み込み後に縦横判定
      svVideoTag.onloadedmetadata = () => {
        const isPortrait = svVideoTag.videoHeight > svVideoTag.videoWidth;
        svVideoWrap.classList.toggle('is-portrait',  isPortrait);
        svVideoWrap.classList.toggle('is-landscape', !isPortrait);

        updateProgress();
        syncPlayButton();
      };

      svVideoTag.play().catch(() => {
        // 自動再生がブロックされた場合もとりあえずボタン表示を合わせる
        syncPlayButton();
      });

      return;
    }

    // 画像
    if (isImage && svImg) {
      svImg.style.display = 'block';
      svImg.src = src;
      return;
    }

    // HTML スニペット
    if (isHtml && svText) {
      fetch(src)
        .then(r => r.text())
        .then(html => {
          svText.innerHTML = html;
          svText.style.display = 'block';
        })
        .catch(() => {
          svText.innerHTML = 'Failed to load.';
          svText.style.display = 'block';
        });
    }
  };

  svButtons.forEach((btn) => {
    // iPhone 対策：pointerdown で開く
    btn.addEventListener('pointerdown', (e) => {
      openSimpleViewer(btn, e);
    });

    // click はキャンセル専用（ダブル発火防止）
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, { passive: false });
  });

  // ==== 閉じる処理 ====
  function closeSV() {
    sv.classList.remove('open');

    if (svVideoWrap && svVideoTag) {
      try { svVideoTag.pause(); } catch (_) {}
      svVideoTag.removeAttribute('src');
      svVideoTag.load();
    }

    resetControls();
  }

  // 背景クリックで閉じる（sv 自体をクリックしたときだけ）
  sv.addEventListener('click', (e) => {
    if (e.target === sv) {
      closeSV();
    }
  });

  // ESC で閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSV();
  });

})();





// ==== gm video controls: progress + PLAY/FULL ====
(function () {
  const gm = document.querySelector('.gm');
  if (!gm) return;

  const videoWrap = gm.querySelector('.gm-video-wrap');
  const video     = videoWrap ? videoWrap.querySelector('video') : null;
  const controls  = gm.querySelector('.sv-controls');

  if (!video || !controls) return;

  const progressTrack = controls.querySelector('.sv-progress');
  const progressBar   = controls.querySelector('.sv-progress__bar');
  const btnPlay       = controls.querySelector('.sv-btn--play');
  const btnFs         = controls.querySelector('.sv-btn--fs');

  // ---- 再生ボタンの表示を同期 ----
  function syncPlayButton() {
    if (!btnPlay) return;
    btnPlay.textContent = video.paused ? 'PLAY' : 'PAUSE';
  }

  // ---- プログレスバー更新 ----
  function updateProgress() {
    if (!progressBar || !video.duration || !isFinite(video.duration)) {
      if (progressBar) {
        progressBar.style.transform = 'scaleX(0)';
      }
      return;
    }
    const ratio = video.currentTime / video.duration;
    // CSS 側が transform: scaleX(0) 前提なので width ではなく transform を更新する
    progressBar.style.transform = `scaleX(${ratio})`;
  }

  video.addEventListener('timeupdate', updateProgress);
  video.addEventListener('loadedmetadata', updateProgress);
  video.addEventListener('play', syncPlayButton);
  video.addEventListener('pause', syncPlayButton);

  // ---- プログレスバーでシーク（ドラッグ対応） ----
  if (progressTrack) {
    let isSeeking = false;

    const seekFromClientX = (clientX) => {
      const rect = progressTrack.getBoundingClientRect();
      if (!rect.width || !video.duration) return;

      let ratio = (clientX - rect.left) / rect.width;
      if (ratio < 0) ratio = 0;
      if (ratio > 1) ratio = 1;

      video.currentTime = ratio * video.duration;
    };

    const onPointerMove = (e) => {
      if (!isSeeking) return;
      e.preventDefault();
      seekFromClientX(e.clientX);
    };

    const onPointerUp = (e) => {
      if (!isSeeking) return;
      isSeeking = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    progressTrack.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation(); // ナビボタンにクリックが伝わらないように

      isSeeking = true;
      seekFromClientX(e.clientX);

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });
  }

  // ---- PLAY / PAUSE ボタン ----
  if (btnPlay) {
    btnPlay.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
      syncPlayButton();
    });
  }

  // ---- FULL ボタン ----
  if (btnFs) {
    btnFs.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (video.requestFullscreen) {
        video.requestFullscreen();
      } else if (video.webkitEnterFullscreen) {
        // iPhone Safari 向け
        video.webkitEnterFullscreen();
      }
    });
  }

  // 初期状態の同期
  syncPlayButton();
  updateProgress();
})();





