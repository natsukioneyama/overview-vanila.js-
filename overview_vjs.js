(function () {
  const container = document.getElementById('grid');
  if (!container) return;

  // ==== 行の高さ（レスポンシブ） ====
  function getRowHeight() {
    const w = window.innerWidth;

    if (w <= 480) return 180;      // iPhone
    if (w <= 768) return 160;      // タブレット小
    if (w <= 1200) return 170;     // ラップトップ
    return 180;                    // デスクトップ広め
  }

  // ==== ボックス間隔（レスポンシブ）====
  function getBoxSpacing() {
    const w = window.innerWidth;

    if (w <= 480) return 10;   // 狭い画面は詰め気味
    if (w <= 768) return 9;    // タブレット
    if (w <= 1200) return 8;   // 中画面
    return 7;                 // 大画面はゆったり
  }

  // ==== アイテム情報 ====
  const itemElements = Array.from(container.children);

  const items = itemElements.map((el) => {
    const w = Number(el.dataset.w) || 1;
    const h = Number(el.dataset.h) || 1;
    return {
      el,
      aspectRatio: w / h
    };
  });














  // ==== グループ & キャプション生成（data-title 単位） ====

  // key = title + line1 でグループ化
  const groups = new Map();

  itemElements.forEach((el) => {
    // 画像 or 動画のメタ情報を取得
    const meta = el.querySelector('.lb-data, img');
    if (!meta) return;

    let title = meta.dataset.title || '';
    const line1 = meta.dataset.line1 || '';
    const line2 = meta.dataset.line2 || '';

    // title が空の場合、line1 を仮タイトルとして使う
    if (!title && line1) {
      title = line1;
    }

    // 両方空ならスキップ
    if (!title) return;

    const key = `${title}|||${line1}`;

    if (!groups.has(key)) {
      groups.set(key, {
        title,
        line1,
        line2,
        members: []
      });
    }
    groups.get(key).members.push(el);

    // グループキーを各アイテムに保存
    el.dataset.groupKey = key;
  });

  // グループの先頭にだけ .ov-cap を付与 & data-head マーク
  groups.forEach((group) => {
    if (!group.members.length) return;

    const headEl = group.members[0];
    headEl.dataset.head = '1';

    const cap = document.createElement('figcaption');
    cap.className = 'ov-cap';

    // title と line1 の関係で表示を分ける
    if (group.title === group.line1) {
      // data-title="" だった → line1 がタイトル扱い
      const b = document.createElement('b');
      b.textContent = group.line1;
      cap.appendChild(b);
    } else {
      // 通常ケース：title がメイン、line1 がサブ
      const b = document.createElement('b');
      b.textContent = group.title;
      cap.appendChild(b);

      if (group.line1) {
        const em = document.createElement('em');
        em.textContent = group.line1;
        cap.appendChild(em);
      }
    }

    if (group.line2) {
      const i = document.createElement('i');
      i.textContent = group.line2;
      cap.appendChild(i);
    }

    headEl.appendChild(cap);
  });
  // ==== グループのハイライト制御（ホバー & タップ共通） ====

  function clearGroupHighlight() {
    container.classList.remove('is-group-hover', 'is-group-tap');

    itemElements.forEach((el) => {
      el.classList.remove('is-in-group', 'tap-armed');
    });
  }

  function setGroupHighlightByKey(key, mode) {
    const group = groups.get(key);
    if (!group) return;

    clearGroupHighlight();

    group.members.forEach((el) => {
      el.classList.add('is-in-group');
    });

    if (mode === 'hover') {
      container.classList.add('is-group-hover');
    } else if (mode === 'tap') {
      container.classList.add('is-group-tap');
    }
  }

  // ==== PC: ホバーでグループキャプション ====
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    itemElements.forEach((el) => {
      const key = el.dataset.groupKey;
      if (!key) return;

      el.addEventListener('mouseenter', () => {
        setGroupHighlightByKey(key, 'hover');
      });

      el.addEventListener('mouseleave', () => {
        clearGroupHighlight();
      });
    });
  }

  // ==== iPhone 等: 1回目タップでキャプション、2回目で Lightbox ====
  // matchMedia だと iOS でうまくマッチしないことがあるので、タッチデバイス判定に変更
  const isTouchDevice =
    ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  if (isTouchDevice) {
    let armedItem = null;

    // capture=true で Lightbox の click より先に処理
    container.addEventListener('click', (e) => {
      const item = e.target.closest('.jl-item');
      if (!item) return;

      const key = item.dataset.groupKey;
      if (!key) return;

      // 1回目タップ（別のサムネ or まだ何も armed されていない）
      if (armedItem !== item) {
        e.preventDefault();
        e.stopPropagation();

        armedItem = item;
        item.classList.add('tap-armed');
        setGroupHighlightByKey(key, 'tap');
        return;
      }

      // 2回目タップ（同じサムネ）
      clearGroupHighlight();
      armedItem = null;
      // preventDefault しない → このまま Lightbox にイベントを渡す
    }, true);
  }

  // ==== レンダリング ====
  function render() {
    const jl = window.justifiedLayout;
    if (!jl) {
      console.error('justifiedLayout が見つかりません');
      return;
    }

    const containerWidth = container.clientWidth;
    if (!containerWidth) return;

    const layout = jl(
      items.map((i) => ({ aspectRatio: i.aspectRatio })),
      {
        containerWidth,
        targetRowHeight: getRowHeight(),  // ★ 可変 row 高さ
        boxSpacing: getBoxSpacing()       // ★ 可変マージン
      }
    );

    container.style.height = layout.containerHeight + 'px';

    layout.boxes.forEach((box, index) => {
      const item = items[index];
      const el = item.el;
      el.style.position = 'absolute';
      el.style.left = box.left + 'px';
      el.style.top = box.top + 'px';
      el.style.width = box.width + 'px';
      el.style.height = box.height + 'px';
    });

    document.body.classList.add('jl-ready');
  }

  // 初回描画
  render();

  // リサイズ時（デバウンス）
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      render();
    }, 150);
  });

})();
















/* ========== Lightbox (gm) ========== */
document.addEventListener('DOMContentLoaded', () => {


  // ここから先は、すでに書いてある処理（items を取って layout する部分）が続く…

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

    // まず静止画を隠す
    gmImg.hidden = true;
    gmImg.classList.remove('ready');
    gmImg.style.pointerEvents = 'none';   // ★ 追加：タップを完全に殺す


    // ラッパーと video を表示準備（ただしフェードインは後で）
    gmVWrap.hidden = false;
    gmVideo.hidden = false;
    gmVWrap.classList.remove('is-ready');

    // ループ ON
    gmVideo.loop = true;

    // ソースをセット（同じ src なら無駄に立ち上げない）
    if (gmVideo.src !== src) {
      gmVideo.src = src;
    }

    // 毎回頭から再生
    gmVideo.currentTime = 0;

    // 最初のフレームが読み込まれたらフェードイン
    const onFirstFrame = () => {
      gmVWrap.classList.add('is-ready');
      gmVideo.removeEventListener('loadeddata', onFirstFrame);
    };
    gmVideo.addEventListener('loadeddata', onFirstFrame);

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
      // ★ スワイプ中はコントロールを非表示
      controls.classList.remove('is-visible');
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





// ==== gm video controls: progress + PLAY/FULL ====
document.addEventListener('DOMContentLoaded', () => {
  const gm = document.getElementById('gm');
  if (!gm) return;

  const videoWrap = gm.querySelector('.gm-video-wrap');
  const video     = document.getElementById('gmVideo');
  const controls  = gm.querySelector('.sv-controls');

  if (!videoWrap || !video || !controls) return;

  const progTrack = controls.querySelector('.sv-progress');
  const progBar   = controls.querySelector('.sv-progress__bar');
  const btnPlay   = controls.querySelector('.sv-btn--play');
  const btnFs     = controls.querySelector('.sv-btn--fs');

  // ---- プログレスバーでシーク ----
  if (progTrack && video) {
    let isSeeking = false;

    const seekFromClientX = (clientX) => {
      const rect = progTrack.getBoundingClientRect();
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

    const onPointerUp = () => {
      if (!isSeeking) return;
      isSeeking = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    progTrack.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      isSeeking = true;
      seekFromClientX(e.clientX);

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });
  }

  // ---- プログレスバー更新 ----
  if (video && progBar) {
    video.addEventListener('timeupdate', () => {
      if (!video.duration) return;
      const ratio = video.currentTime / video.duration;
      progBar.style.width = `${ratio * 100}%`;
    });

    video.addEventListener('loadedmetadata', () => {
      progBar.style.width = '0%';
    });
  }

  // ---- 再生 / 一時停止 ----
  if (btnPlay && video) {
    btnPlay.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (video.paused) {
        video.play().catch(() => {});
        btnPlay.textContent = 'PAUSE';
      } else {
        video.pause();
        btnPlay.textContent = 'PLAY';
      }
    });
  }

  // ---- フルスクリーン ----
  if (btnFs && video) {
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



    // ---- iPhone 等: タップでコントロール表示 ----
  const isTouch =
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);

  if (isTouch) {
    // ★ iPhone / Android 用：動画をタップしたらフェード表示（トグル）
    const handleTap = (e) => {
      e.stopPropagation();
      // is-visible を付けたり消したりするだけ
      controls.classList.toggle('is-visible');
    };

    // 動画本体をタップ
    video.addEventListener('click', handleTap);
    video.addEventListener('touchstart', handleTap, { passive: true });
    
    // ★ ラッパー領域（コントロール含む）もタップ受け付ける
    videoWrap.addEventListener('click', handleTap);
    videoWrap.addEventListener('touchstart', handleTap, { passive: true });

  } else {
    // ★ PC：is-visible は使わず、hover だけに任せる
    controls.classList.remove('is-visible');
  }

}); // ← gm video controls 用 DOMContentLoaded の閉じ

