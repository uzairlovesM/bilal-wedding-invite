(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const byId = id => document.getElementById(id);
  const body = document.body;
  const intro = byId('introScreen');
  const envelope = byId('envelope');
  const stage = byId('envelopeStage');
  const landingCaption = byId('landingCaption');
  const website = byId('website');
  const toast = byId('toastMessage');
  const guestModal = byId('guestModal');
  const rsvpModal = byId('rsvpModal');
  const qrModal = byId('qrModal');
  const lightbox = byId('lightbox');
  const preloader = byId('preloader');
  const bgAudio = byId('bgAudio');

  /* ---------------------------------------------------------------------
   * Event data — single source of truth. Countdown + status + ICS files
   * + RSVP checklist all read from this array so nothing drifts apart.
   * ------------------------------------------------------------------- */
  const events = [
    {
      id: 'mehndi',
      title: 'مہندی',
      titleEnglish: 'Mehndi',
      date: '20261128T160000Z',
      end: '20261128T180000Z',
      localDate: '۲۸ نومبر ۲۰۲۶',
      localTime: 'رات ۹:۰۰ بجے',
      venue: 'حمزہ ٹاؤن، پنڈی بھٹیاں',
      mapQuery: 'Hamza+Town+Pindi+Bhattian+Pakistan',
      startMs: Date.UTC(2026, 10, 28, 16, 0, 0),
      endMs: Date.UTC(2026, 10, 28, 18, 0, 0)
    },
    {
      id: 'barat',
      title: 'بارات',
      titleEnglish: 'Barat',
      date: '20261129T080000Z',
      end: '20261129T110000Z',
      localDate: '۲۹ نومبر ۲۰۲۶',
      localTime: 'دوپہر ۱:۰۰ بجے',
      venue: 'حمزہ ٹاؤن، پنڈی بھٹیاں',
      mapQuery: 'Hamza+Town+Pindi+Bhattian+Pakistan',
      startMs: Date.UTC(2026, 10, 29, 8, 0, 0),
      endMs: Date.UTC(2026, 10, 29, 11, 0, 0)
    },
    {
      id: 'walima',
      title: 'ولیمہ',
      titleEnglish: 'Walima',
      date: '20261130T090000Z',
      end: '20261130T120000Z',
      localDate: '۳۰ نومبر ۲۰۲۶',
      localTime: 'دوپہر ۲:۰۰ بجے',
      venue: 'ملک میرج ہال',
      mapQuery: 'Malik+Marriage+Hall+Pindi+Bhattian+Pakistan',
      startMs: Date.UTC(2026, 10, 30, 9, 0, 0),
      endMs: Date.UTC(2026, 10, 30, 12, 0, 0)
    }
  ];

  const galleryItems = [
    { src: 'assets/mehndi-scene.webp', title: 'مہندی کی شام' },
    { src: 'assets/barat-scene.webp', title: 'بارات کا استقبال' },
    { src: 'assets/walima-scene.webp', title: 'ولیمہ کی ضیافت' }
  ];

  let envelopeOpened = false;
  let autoOpenTimer = 0;
  let toastTimer = 0;
  let countdownTimer = 0;
  let galleryIndex = 0;
  let previousFocus = null;
  let speech = null;
  let motionPaused = false;
  let musicPlaying = false;
  let rsvpChoice = '';

  /* ----------------------------- storage -------------------------------- */
  const storage = {
    get(key) {
      try { return window.localStorage.getItem(key); } catch (error) { return null; }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, value); return true; } catch (error) { return false; }
    },
    remove(key) {
      try { window.localStorage.removeItem(key); } catch (error) { return false; }
      return true;
    },
    getJSON(key) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (error) { return null; }
    },
    setJSON(key, value) {
      try { window.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (error) { return false; }
    }
  };

  const toUrduDigits = value => String(value).replace(/[0-9]/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);

  const showToast = message => {
    toast.textContent = message;
    toast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 3200);
  };

  /* --------------------------- preloader --------------------------------- */
  const hidePreloader = () => {
    if (!preloader) { body.classList.remove('preload-lock'); return; }
    preloader.classList.add('preloader-done');
    body.classList.remove('preload-lock');
    window.setTimeout(() => { preloader.hidden = true; }, 700);
  };

  const waitForAssets = () => {
    const images = $$('img').map(img => new Promise(resolve => {
      if (img.complete) { resolve(); return; }
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    }));
    const fonts = (document.fonts && document.fonts.ready) ? document.fonts.ready.catch(() => {}) : Promise.resolve();
    const minimumShow = new Promise(resolve => window.setTimeout(resolve, 600));
    Promise.race([
      Promise.all([...images, fonts, minimumShow]),
      new Promise(resolve => window.setTimeout(resolve, 3200))
    ]).then(hidePreloader);
  };

  /* ---------------------------- confetti --------------------------------- */
  const confettiCanvas = byId('confettiCanvas');
  const confettiCtx = confettiCanvas ? confettiCanvas.getContext('2d') : null;
  let confettiPieces = [];
  let confettiRaf = 0;

  const resizeConfettiCanvas = () => {
    if (!confettiCanvas) return;
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  };

  const confettiColors = ['#d1a95e', '#8c3d35', '#23442f', '#f0d995', '#b86b69', '#294761'];

  const burstConfetti = (count = 140) => {
    if (!confettiCtx || motionPaused) return;
    resizeConfettiCanvas();
    const originX = confettiCanvas.width / 2;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.random() * Math.PI) + Math.PI;
      const speed = 4 + Math.random() * 9;
      confettiPieces.push({
        x: originX + (Math.random() - 0.5) * 180,
        y: confettiCanvas.height * 0.32,
        vx: Math.cos(angle) * speed * 0.6,
        vy: Math.sin(angle) * speed * -1,
        gravity: 0.17 + Math.random() * 0.08,
        size: 4 + Math.random() * 6,
        rotation: Math.random() * 360,
        spin: (Math.random() - 0.5) * 14,
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        life: 0,
        maxLife: 140 + Math.random() * 60,
        shape: Math.random() > 0.5 ? 'rect' : 'circle'
      });
    }
    if (!confettiRaf) runConfetti();
  };

  const runConfetti = () => {
    if (!confettiCtx) return;
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiPieces.forEach(piece => {
      piece.vy += piece.gravity;
      piece.x += piece.vx;
      piece.y += piece.vy;
      piece.rotation += piece.spin;
      piece.life += 1;
      const fade = Math.max(0, 1 - piece.life / piece.maxLife);
      confettiCtx.save();
      confettiCtx.globalAlpha = fade;
      confettiCtx.translate(piece.x, piece.y);
      confettiCtx.rotate((piece.rotation * Math.PI) / 180);
      confettiCtx.fillStyle = piece.color;
      if (piece.shape === 'rect') {
        confettiCtx.fillRect(-piece.size / 2, -piece.size / 3, piece.size, piece.size * 0.6);
      } else {
        confettiCtx.beginPath();
        confettiCtx.arc(0, 0, piece.size / 2, 0, Math.PI * 2);
        confettiCtx.fill();
      }
      confettiCtx.restore();
    });
    confettiPieces = confettiPieces.filter(piece => piece.life < piece.maxLife && piece.y < confettiCanvas.height + 60);
    if (confettiPieces.length) {
      confettiRaf = window.requestAnimationFrame(runConfetti);
    } else {
      confettiRaf = 0;
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
  };

  window.addEventListener('resize', resizeConfettiCanvas, { passive: true });

  /* ------------------------------ envelope -------------------------------- */
  const createDustBurst = () => {
    const dust = byId('impactDust');
    const colors = ['#d1a95e', '#f0d995', '#f4e7c4', '#b78348', '#e4bd76'];
    for (let index = 0; index < 34; index += 1) {
      const particle = document.createElement('span');
      const angle = Math.random() * Math.PI * 2;
      const distance = 35 + Math.random() * 115;
      particle.className = 'dust-particle';
      particle.style.setProperty('--dust-x', `${Math.cos(angle) * distance}px`);
      particle.style.setProperty('--dust-y', `${Math.sin(angle) * distance - 24}px`);
      particle.style.setProperty('--dust-size', `${2 + Math.random() * 4}px`);
      particle.style.setProperty('--dust-duration', `${.55 + Math.random() * .55}s`);
      particle.style.setProperty('--dust-color', colors[index % colors.length]);
      dust.appendChild(particle);
      window.setTimeout(() => particle.remove(), 1300);
    }
  };

  const createSparkleRing = () => {
    const dust = byId('impactDust');
    for (let index = 0; index < 14; index += 1) {
      const sparkle = document.createElement('span');
      const angle = (index / 14) * Math.PI * 2;
      sparkle.className = 'sparkle-particle';
      sparkle.style.setProperty('--sparkle-x', `${Math.cos(angle) * 150}px`);
      sparkle.style.setProperty('--sparkle-y', `${Math.sin(angle) * 95 - 40}px`);
      sparkle.style.setProperty('--sparkle-delay', `${index * 0.025}s`);
      dust.appendChild(sparkle);
      window.setTimeout(() => sparkle.remove(), 1500);
    }
  };

  const markEnvelopeLanded = () => {
    if (envelopeOpened || envelope.classList.contains('landed')) return;
    envelope.classList.add('landed');
    $('.envelope-shadow').classList.add('shadow-landed');
    $('.envelope-ground').classList.add('ground-landed');
    $('.impact-ring').classList.add('ring-hit');
    landingCaption.classList.add('visible');
    createDustBurst();
    autoOpenTimer = window.setTimeout(openInvitation, 1650);
  };

  const revealWebsite = () => {
    intro.classList.add('intro-closing');
    window.setTimeout(() => {
      intro.hidden = true;
      body.classList.add('site-ready');
      website.setAttribute('aria-hidden', 'false');
      body.classList.remove('modal-open', 'intro-active');
      startPageSystems();
      window.scrollTo({ top: 0, behavior: 'auto' });
    }, 900);
  };

  function openInvitation() {
    if (envelopeOpened) return;
    envelopeOpened = true;
    window.clearTimeout(autoOpenTimer);
    envelope.classList.add('opening');
    createDustBurst();
    createSparkleRing();
    burstConfetti(150);
    window.setTimeout(() => envelope.classList.add('opened'), 720);
    window.setTimeout(revealWebsite, 1750);
  }

  envelope.addEventListener('animationend', event => {
    if (event.animationName === 'envelopeDrop') markEnvelopeLanded();
  });
  envelope.addEventListener('click', openInvitation);
  byId('introSkip').addEventListener('click', openInvitation);

  const replayEnvelope = () => {
    window.clearTimeout(autoOpenTimer);
    envelopeOpened = false;
    body.classList.remove('site-ready');
    body.classList.add('intro-active');
    website.setAttribute('aria-hidden', 'true');
    intro.hidden = false;
    intro.classList.remove('intro-closing');
    landingCaption.classList.remove('visible');
    envelope.classList.remove('landed', 'opening', 'opened');
    $('.envelope-shadow').classList.remove('shadow-landed');
    $('.envelope-ground').classList.remove('ground-landed');
    $('.impact-ring').classList.remove('ring-hit');
    envelope.style.animation = 'none';
    void envelope.offsetHeight;
    envelope.style.animation = '';
    if (motionPaused) {
      envelope.style.animation = 'none';
      envelope.classList.add('landed');
      landingCaption.classList.add('visible');
      autoOpenTimer = window.setTimeout(openInvitation, 700);
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  byId('replayEnvelope').addEventListener('click', replayEnvelope);

  /* ------------------------------- petals --------------------------------- */
  const createPetals = () => {
    const container = byId('petalCanvas');
    const palette = ['#e8b9ae', '#c77b7a', '#f2d5b0', '#c9a96c', '#f0c9c0'];
    for (let index = 0; index < 22; index += 1) {
      const petal = document.createElement('span');
      petal.className = 'petal';
      petal.style.left = `${Math.random() * 100}%`;
      petal.style.setProperty('--fall-time', `${11 + Math.random() * 12}s`);
      petal.style.setProperty('--fall-delay', `${-Math.random() * 18}s`);
      petal.style.setProperty('--drift-x', `${-100 + Math.random() * 200}px`);
      petal.style.setProperty('--petal-rotation', `${Math.random() * 180}deg`);
      petal.style.background = `linear-gradient(145deg, #f7e3d5, ${palette[index % palette.length]})`;
      container.appendChild(petal);
    }
  };

  /* ----------------------------- countdown --------------------------------- */
  const getActiveOrNextEvent = () => {
    const now = Date.now();
    const live = events.find(event => now >= event.startMs && now <= event.endMs);
    if (live) return { event: live, state: 'live' };
    const upcoming = events.find(event => now < event.startMs);
    if (upcoming) return { event: upcoming, state: 'upcoming' };
    return { event: null, state: 'done' };
  };

  const updateCountdown = () => {
    const status = byId('countdownStatus');
    const heading = byId('countdownHeading');
    const subIntro = byId('countdownSubIntro');
    const { event, state } = getActiveOrNextEvent();

    if (state === 'done' || !event) {
      byId('countDays').textContent = '۰۰';
      byId('countHours').textContent = '۰۰';
      byId('countMinutes').textContent = '۰۰';
      byId('countSeconds').textContent = '۰۰';
      heading.textContent = 'خوشیوں کا سفر مکمل ہوچکا';
      subIntro.textContent = 'اللہ تعالیٰ اس رشتے کو ہمیشہ خوش و خرم رکھے';
      status.textContent = 'تمام تقریبات بخیر و خوبی اختتام پذیر ہوگئیں — آمین';
      return;
    }

    heading.textContent = state === 'live' ? `${event.title} کی تقریب جاری ہے` : `${event.title} کی تقریب تک باقی وقت`;
    subIntro.textContent = state === 'live' ? 'تقریب میں شرکت کے لیے تشریف لائیے' : `${event.title} کی خوشیوں کا انتظار اب لمحوں میں`;

    const target = state === 'live' ? event.endMs : event.startMs;
    const difference = target - Date.now();
    const totalSeconds = Math.max(0, Math.floor(difference / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    byId('countDays').textContent = toUrduDigits(String(days).padStart(2, '0'));
    byId('countHours').textContent = toUrduDigits(String(hours).padStart(2, '0'));
    byId('countMinutes').textContent = toUrduDigits(String(minutes).padStart(2, '0'));
    byId('countSeconds').textContent = toUrduDigits(String(seconds).padStart(2, '0'));
    status.textContent = `${event.localDate} — ${event.localTime}، پاکستان کے مقامی وقت کے مطابق`;

    $$('#countdownDots [data-dot]').forEach(dot => {
      dot.classList.remove('dot-active', 'dot-done');
      if (dot.dataset.dot === event.id) dot.classList.add('dot-active');
      else {
        const dotEvent = events.find(item => item.id === dot.dataset.dot);
        if (dotEvent && Date.now() > dotEvent.endMs) dot.classList.add('dot-done');
      }
    });
  };

  /* -------------------------------- ICS ------------------------------------- */
  const escapeIcs = value => String(value).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  const createCalendarEntry = event => {
    const uid = `${event.id}-bilal-hasan-2026@invitation.local`;
    const lines = [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
      `DTSTART:${event.date}`,
      `DTEND:${event.end}`,
      `SUMMARY:${escapeIcs(`${event.titleEnglish} — Bilal Hasan Wedding`)}`,
      `DESCRIPTION:${escapeIcs(`بلال حسن فرزند ظفر اقبال کی ${event.title} کی تقریب۔ وقت: ${event.localTime}۔`)}`,
      `LOCATION:${escapeIcs(`${event.venue}، پاکستان`)}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT2H',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcs(`${event.titleEnglish} دو گھنٹوں میں شروع ہوگی`)}`,
      'END:VALARM',
      'END:VEVENT'
    ];
    return lines.join('\r\n');
  };

  const downloadCalendar = selection => {
    const chosen = selection ? events.filter(event => event.id === selection) : events;
    if (!chosen.length) return;
    const content = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Bilal Hasan Wedding//Urdu Invitation//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      ...chosen.map(createCalendarEntry),
      'END:VCALENDAR'
    ].join('\r\n');
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = selection ? `bilal-hasan-${selection}.ics` : 'bilal-hasan-all-events.ics';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    showToast(selection ? 'تقریب کیلنڈر میں محفوظ کرنے کے لیے تیار ہے' : 'تینوں تقریبات کی کیلنڈر فائل تیار ہے');
  };

  $$('.calendar-action').forEach(button => {
    button.addEventListener('click', () => downloadCalendar(button.dataset.calendar));
  });
  byId('calendarAll').addEventListener('click', () => downloadCalendar());

  /* ----------------------------- guest name --------------------------------- */
  const openGuestModal = () => {
    previousFocus = document.activeElement;
    byId('guestName').value = storage.get('bilalWeddingGuestName') || '';
    guestModal.classList.add('visible');
    guestModal.setAttribute('aria-hidden', 'false');
    body.classList.add('modal-open');
    window.setTimeout(() => byId('guestName').focus(), 80);
  };

  const closeGuestModal = () => {
    guestModal.classList.remove('visible');
    guestModal.setAttribute('aria-hidden', 'true');
    body.classList.remove('modal-open');
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
  };

  const updateGuestGreeting = name => {
    const greeting = byId('guestGreeting');
    if (!name) {
      greeting.hidden = true;
      greeting.textContent = '';
      return;
    }
    greeting.textContent = `محترم ${name} صاحب، آپ کو خوش آمدید`;
    greeting.hidden = false;
  };

  byId('guestButton').addEventListener('click', openGuestModal);
  byId('mobileGuestButton')?.addEventListener('click', () => { closeMobileNav(); openGuestModal(); });
  byId('guestClose').addEventListener('click', closeGuestModal);
  guestModal.addEventListener('click', event => {
    if (event.target === guestModal) closeGuestModal();
  });
  byId('saveGuest').addEventListener('click', () => {
    const value = byId('guestName').value.trim();
    if (!value) {
      showToast('پہلے اپنا نام درج کریں');
      byId('guestName').focus();
      return;
    }
    storage.set('bilalWeddingGuestName', value);
    updateGuestGreeting(value);
    closeGuestModal();
    showToast('دعوت نامہ آپ کے نام سے ترتیب دے دیا گیا ہے');
  });
  byId('guestName').addEventListener('keydown', event => {
    if (event.key === 'Enter') byId('saveGuest').click();
  });
  byId('clearGuest').addEventListener('click', () => {
    storage.remove('bilalWeddingGuestName');
    byId('guestName').value = '';
    updateGuestGreeting('');
    closeGuestModal();
    showToast('مہمان کا نام ہٹا دیا گیا ہے');
  });

  /* -------------------------------- RSVP -------------------------------------- */
  const rsvpLabels = { yes: 'شرکت کی تصدیق', maybe: 'غیر یقینی', no: 'معذرت' };

  const openRsvpModal = () => {
    previousFocus = document.activeElement;
    const saved = storage.getJSON('bilalWeddingRsvp');
    if (saved) {
      byId('rsvpName').value = saved.name || storage.get('bilalWeddingGuestName') || '';
      byId('rsvpGuests').value = saved.guests || 1;
      byId('rsvpMessage').value = saved.message || '';
      rsvpChoice = saved.choice || '';
      $$('.rsvp-choice').forEach(btn => {
        const active = btn.dataset.rsvpChoice === rsvpChoice;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
      });
      $$('#rsvpEventsGrid input').forEach(input => {
        input.checked = !saved.events || saved.events.includes(input.value);
      });
    } else {
      byId('rsvpName').value = storage.get('bilalWeddingGuestName') || '';
    }
    rsvpModal.classList.add('visible');
    rsvpModal.setAttribute('aria-hidden', 'false');
    body.classList.add('modal-open');
    window.setTimeout(() => byId('rsvpName').focus(), 80);
  };

  const closeRsvpModal = () => {
    rsvpModal.classList.remove('visible');
    rsvpModal.setAttribute('aria-hidden', 'true');
    body.classList.remove('modal-open');
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
  };

  byId('rsvpButton').addEventListener('click', openRsvpModal);
  byId('mobileRsvpButton')?.addEventListener('click', () => { closeMobileNav(); openRsvpModal(); });
  byId('rsvpClose').addEventListener('click', closeRsvpModal);
  rsvpModal.addEventListener('click', event => { if (event.target === rsvpModal) closeRsvpModal(); });

  $$('.rsvp-choice').forEach(button => {
    button.addEventListener('click', () => {
      rsvpChoice = button.dataset.rsvpChoice;
      $$('.rsvp-choice').forEach(btn => {
        const active = btn === button;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
      });
    });
  });

  const updateRsvpBadge = data => {
    const badge = byId('rsvpBadge');
    if (!data || !data.choice) { badge.hidden = true; return; }
    const map = { yes: 'آپ کی شرکت کی تصدیق ہوچکی ہے ✓', maybe: 'آپ نے ابھی غیر یقینی درج کیا ہے', no: 'آپ نے معذرت درج کی ہے' };
    badge.textContent = map[data.choice] || '';
    badge.hidden = false;
    badge.className = `rsvp-badge rsvp-badge-${data.choice}`;
  };

  const collectRsvp = () => {
    const name = byId('rsvpName').value.trim();
    if (!name) { showToast('پہلے اپنا نام درج کریں'); byId('rsvpName').focus(); return null; }
    if (!rsvpChoice) { showToast('براہِ کرم شرکت کی تصدیق منتخب کریں'); return null; }
    const chosenEvents = $$('#rsvpEventsGrid input:checked').map(input => input.value);
    return {
      name,
      choice: rsvpChoice,
      guests: Number(byId('rsvpGuests').value) || 0,
      events: chosenEvents,
      message: byId('rsvpMessage').value.trim(),
      savedAt: new Date().toISOString()
    };
  };

  const buildRsvpText = data => {
    const lines = [
      'دعوتِ شادی — بلال حسن فرزند ظفر اقبال کے لیے حاضری کی تصدیق',
      `نام: ${data.name}`,
      `جواب: ${rsvpLabels[data.choice] || data.choice}`,
      `مہمانوں کی تعداد: ${data.guests}`
    ];
    if (data.events.length) {
      const names = data.events.map(id => events.find(event => event.id === id)?.title || id).join('، ');
      lines.push(`تقریبات: ${names}`);
    }
    if (data.message) lines.push(`پیغام: ${data.message}`);
    return lines.join('\n');
  };

  byId('saveRsvp').addEventListener('click', () => {
    const data = collectRsvp();
    if (!data) return;
    storage.setJSON('bilalWeddingRsvp', data);
    storage.set('bilalWeddingGuestName', data.name);
    updateGuestGreeting(data.name);
    updateRsvpBadge(data);
    const note = byId('rsvpSavedNote');
    note.hidden = false;
    note.textContent = 'آپ کی تصدیق محفوظ ہوگئی ہے، شکریہ!';
    if (data.choice === 'yes') burstConfetti(90);
    showToast('حاضری کی تصدیق محفوظ کرلی گئی ہے');
    window.setTimeout(closeRsvpModal, 900);
  });

  byId('sendRsvpWhatsapp').addEventListener('click', () => {
    const data = collectRsvp();
    if (!data) return;
    storage.setJSON('bilalWeddingRsvp', data);
    updateRsvpBadge(data);
    const text = encodeURIComponent(buildRsvpText(data));
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener');
  });

  /* -------------------------------- gallery ------------------------------------ */
  const openGallery = index => {
    galleryIndex = (index + galleryItems.length) % galleryItems.length;
    const item = galleryItems[galleryIndex];
    byId('lightboxImage').src = item.src;
    byId('lightboxImage').alt = item.title;
    byId('lightboxCaption').textContent = item.title;
    byId('lightboxCounter').textContent = `${toUrduDigits(galleryIndex + 1)} / ${toUrduDigits(galleryItems.length)}`;
    lightbox.classList.add('visible');
    lightbox.setAttribute('aria-hidden', 'false');
    body.classList.add('modal-open');
    byId('lightboxClose').focus();
  };

  const closeGallery = () => {
    lightbox.classList.remove('visible');
    lightbox.setAttribute('aria-hidden', 'true');
    body.classList.remove('modal-open');
    byId('lightboxImage').src = '';
  };

  $$('[data-gallery]').forEach(button => {
    button.addEventListener('click', () => openGallery(Number(button.dataset.gallery)));
  });
  byId('lightboxClose').addEventListener('click', closeGallery);
  byId('lightboxNext').addEventListener('click', () => openGallery(galleryIndex + 1));
  byId('lightboxPrev').addEventListener('click', () => openGallery(galleryIndex - 1));
  lightbox.addEventListener('click', event => { if (event.target === lightbox) closeGallery(); });

  /* -------------------------------- speech -------------------------------------- */
  const speakInvitation = () => {
    if (!('speechSynthesis' in window)) {
      showToast('اس براؤزر میں اردو آواز کی سہولت دستیاب نہیں');
      return;
    }
    if (musicPlaying) toggleMusic(false);
    if (speech) window.speechSynthesis.cancel();
    const text = [
      'بسم اللہ الرحمن الرحیم۔',
      'دعوت شادی۔',
      'بلال حسن، فرزند جناب ظفر اقبال صاحب۔',
      'آپ کو شادی کی تقریبات میں شرکت کی پُرخلوص دعوت دی جاتی ہے۔',
      'مہندی، اٹھائیس نومبر دو ہزار چھبیس، بروز ہفتہ، رات نو بجے، حمزہ ٹاؤن پنڈی بھٹیاں۔',
      'بارات، انتیس نومبر دو ہزار چھبیس، بروز اتوار، دوپہر ایک بجے، حمزہ ٹاؤن پنڈی بھٹیاں۔',
      'ولیمہ، تیس نومبر دو ہزار چھبیس، بروز سوموار، دوپہر دو بجے، ملک میرج ہال۔',
      'آپ کی آمد ہمارے لیے باعث عزت و مسرت ہوگی۔'
    ].join(' ');
    speech = new SpeechSynthesisUtterance(text);
    speech.lang = 'ur-PK';
    speech.rate = .84;
    speech.pitch = 1;
    window.speechSynthesis.speak(speech);
    showToast('دعوت نامہ سنایا جا رہا ہے');
  };

  byId('readInvitation').addEventListener('click', speakInvitation);
  byId('printInvitation').addEventListener('click', () => window.print());

  const buildShareText = () => {
    const guestName = storage.get('bilalWeddingGuestName');
    const lines = [
      guestName ? `محترم ${guestName} صاحب،` : null,
      'دعوتِ شادی — بلال حسن',
      'فرزندِ جناب ظفر اقبال صاحب',
      'مہندی: ۲۸ نومبر ۲۰۲۶، رات ۹ بجے، حمزہ ٹاؤن، پنڈی بھٹیاں',
      'بارات: ۲۹ نومبر ۲۰۲۶، دوپہر ۱ بجے، حمزہ ٹاؤن، پنڈی بھٹیاں',
      'ولیمہ: ۳۰ نومبر ۲۰۲۶، دوپہر ۲ بجے، ملک میرج ہال'
    ].filter(Boolean);
    return lines.join('\n');
  };

  byId('shareInvitation').addEventListener('click', async () => {
    const invitationText = buildShareText();
    try {
      await navigator.clipboard.writeText(invitationText);
      showToast('دعوت کی مکمل عبارت نقل ہوگئی ہے');
    } catch (error) {
      const helper = document.createElement('textarea');
      helper.value = invitationText;
      helper.setAttribute('readonly', '');
      helper.style.position = 'fixed';
      helper.style.opacity = '0';
      document.body.appendChild(helper);
      helper.select();
      const copied = document.execCommand('copy');
      helper.remove();
      showToast(copied ? 'دعوت کی مکمل عبارت نقل ہوگئی ہے' : 'عبارت نقل نہیں ہوسکی');
    }
  });

  byId('whatsappShare').addEventListener('click', () => {
    const text = encodeURIComponent(buildShareText());
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener');
  });

  const whatsappFab = byId('whatsappFab');
  if (whatsappFab) {
    whatsappFab.addEventListener('click', event => {
      event.preventDefault();
      const text = encodeURIComponent(buildShareText());
      window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener');
    });
  }

  byId('nativeShare').addEventListener('click', async () => {
    const shareData = { title: 'دعوتِ شادی | بلال حسن', text: buildShareText(), url: window.location.href };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (error) { /* user cancelled */ }
    } else {
      byId('shareInvitation').click();
    }
  });

  byId('fullscreenInvitation').addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        showToast('پوری اسکرین کا منظر فعال ہوگیا ہے');
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      showToast('اس براؤزر میں پوری اسکرین کی سہولت دستیاب نہیں');
    }
  });

  /* ---------------------------------- QR code ------------------------------------ */
  byId('qrButton').addEventListener('click', () => {
    qrModal.classList.add('visible');
    qrModal.setAttribute('aria-hidden', 'false');
    body.classList.add('modal-open');
    byId('qrUrl').textContent = window.location.href;
    const canvas = byId('qrCanvas');
    if (window.QRCode && canvas) {
      window.QRCode.toCanvas(canvas, window.location.href, {
        width: 220,
        margin: 1,
        color: { dark: '#23442f', light: '#fffaf1' }
      }, error => {
        if (error) showToast('کیو آر کوڈ بنانے میں مسئلہ پیش آیا');
      });
    } else {
      showToast('کیو آر کوڈ لائبریری لوڈ نہیں ہوسکی، انٹرنیٹ چیک کریں');
    }
  });
  byId('qrClose').addEventListener('click', () => {
    qrModal.classList.remove('visible');
    qrModal.setAttribute('aria-hidden', 'true');
    body.classList.remove('modal-open');
  });
  qrModal.addEventListener('click', event => {
    if (event.target === qrModal) byId('qrClose').click();
  });

  /* ----------------------------------- theme -------------------------------------- */
  const applyTheme = theme => {
    body.classList.toggle('theme-dark', theme === 'dark');
    const toggle = byId('themeToggle');
    toggle.textContent = theme === 'dark' ? '☀' : '☽';
    toggle.setAttribute('aria-pressed', String(theme === 'dark'));
    toggle.setAttribute('aria-label', theme === 'dark' ? 'دن کا تھیم' : 'رات کا تھیم');
  };
  byId('themeToggle').addEventListener('click', () => {
    const next = body.classList.contains('theme-dark') ? 'light' : 'dark';
    applyTheme(next);
    storage.set('bilalWeddingTheme', next);
  });

  /* ----------------------------------- music -------------------------------------- */
  const toggleMusic = force => {
    if (!bgAudio) return;
    const shouldPlay = typeof force === 'boolean' ? force : !musicPlaying;
    const control = byId('musicToggle');
    if (shouldPlay) {
      bgAudio.play().then(() => {
        musicPlaying = true;
        control.textContent = '❚❚';
        control.setAttribute('aria-pressed', 'true');
        control.setAttribute('aria-label', 'موسیقی روکیں');
      }).catch(() => {
        showToast('موسیقی فائل دستیاب نہیں — assets/nasheed.mp3 شامل کریں');
      });
    } else {
      bgAudio.pause();
      musicPlaying = false;
      control.textContent = '♪';
      control.setAttribute('aria-pressed', 'false');
      control.setAttribute('aria-label', 'موسیقی چلائیں');
    }
  };
  byId('musicToggle').addEventListener('click', () => toggleMusic());

  /* --------------------------------- mobile nav ------------------------------------- */
  const mobileNav = byId('mobileNav');
  const mobileNavBackdrop = byId('mobileNavBackdrop');
  const navBurger = byId('navBurger');

  const openMobileNav = () => {
    mobileNav.classList.add('open');
    mobileNavBackdrop.classList.add('visible');
    mobileNav.setAttribute('aria-hidden', 'false');
    navBurger.setAttribute('aria-expanded', 'true');
    navBurger.classList.add('burger-open');
    body.classList.add('modal-open');
  };
  function closeMobileNav() {
    mobileNav.classList.remove('open');
    mobileNavBackdrop.classList.remove('visible');
    mobileNav.setAttribute('aria-hidden', 'true');
    navBurger.setAttribute('aria-expanded', 'false');
    navBurger.classList.remove('burger-open');
    body.classList.remove('modal-open');
  }
  navBurger?.addEventListener('click', () => {
    if (mobileNav.classList.contains('open')) closeMobileNav(); else openMobileNav();
  });
  mobileNavBackdrop?.addEventListener('click', closeMobileNav);
  $$('[data-mobile-link]').forEach(link => link.addEventListener('click', closeMobileNav));
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900 && mobileNav.classList.contains('open')) closeMobileNav();
  });

  /* ------------------------------------ motion -------------------------------------- */
  byId('motionToggle').addEventListener('click', () => {
    motionPaused = !motionPaused;
    body.classList.toggle('motion-paused', motionPaused);
    byId('motionToggle').textContent = motionPaused ? '▶' : 'Ⅱ';
    byId('motionToggle').setAttribute('aria-pressed', String(motionPaused));
    byId('motionToggle').setAttribute('aria-label', motionPaused ? 'حرکت دوبارہ چلائیں' : 'حرکت روکیں');
    showToast(motionPaused ? 'اینیمیشن روک دی گئی ہے' : 'اینیمیشن دوبارہ چل رہی ہے');
  });

  /* --------------------------------- event status ------------------------------------ */
  const updateEventStatuses = () => {
    const now = Date.now();
    const upcoming = events.find(event => event.endMs > now);
    events.forEach(event => {
      const card = $(`[data-event="${event.id}"]`);
      const status = $(`[data-status="${event.id}"]`);
      if (!card || !status) return;
      card.classList.remove('event-next', 'event-passed', 'event-live');
      if (now < event.startMs) {
        status.textContent = 'آنے والی تقریب';
        if (upcoming && upcoming.id === event.id) card.classList.add('event-next');
      } else if (now <= event.endMs) {
        status.textContent = 'تقریب جاری ہے';
        card.classList.add('event-live');
      } else {
        status.textContent = 'تقریب مکمل ہوگئی';
        card.classList.add('event-passed');
      }
    });
  };

  /* ---------------------------------- scroll UI --------------------------------------- */
  const updateScrollUI = () => {
    const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
    const position = documentHeight > 0 ? Math.min(100, (window.scrollY / documentHeight) * 100) : 0;
    byId('readingProgress').style.width = `${position}%`;
    byId('backToTop').classList.toggle('visible', window.scrollY > 450);
    const ring = byId('backToTopProgress');
    if (ring) {
      const circumference = 2 * Math.PI * 19;
      ring.style.strokeDasharray = `${circumference}`;
      ring.style.strokeDashoffset = `${circumference * (1 - position / 100)}`;
    }
    body.classList.toggle('header-scrolled', window.scrollY > 40);
  };
  window.addEventListener('scroll', updateScrollUI, { passive: true });
  byId('backToTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* ------------------------------- reveal + lazy images -------------------------------- */
  const observeCards = () => {
    const cards = $$('.reveal-card');
    if (!('IntersectionObserver' in window)) {
      cards.forEach(card => card.classList.add('in-view'));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      });
    }, { threshold: .16, rootMargin: '0px 0px -35px 0px' });
    cards.forEach(card => observer.observe(card));
  };

  const observeImageLoading = () => {
    $$('img[loading="lazy"]').forEach(image => {
      image.addEventListener('error', () => {
        image.closest('.event-image, .gallery-tile')?.classList.add('image-fallback');
      }, { once: true });
    });
  };

  const setGuestOnLoad = () => {
    const name = storage.get('bilalWeddingGuestName');
    if (name) updateGuestGreeting(name);
    const rsvp = storage.getJSON('bilalWeddingRsvp');
    if (rsvp) updateRsvpBadge(rsvp);
  };

  /* ---------------------------------- parallax ------------------------------------------ */
  const initParallax = () => {
    const layer = $('.hero-side-art');
    if (!layer || window.matchMedia('(pointer: coarse)').matches) return;
    document.addEventListener('mousemove', event => {
      if (motionPaused) return;
      const x = (event.clientX / window.innerWidth - 0.5) * 2;
      const y = (event.clientY / window.innerHeight - 0.5) * 2;
      layer.style.transform = `translate3d(${x * 10}px, ${y * 8}px, 0)`;
    }, { passive: true });
  };

  /* ---------------------------------- keyboard ------------------------------------------- */
  const keyboardControls = () => {
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        if (lightbox.classList.contains('visible')) closeGallery();
        if (guestModal.classList.contains('visible')) closeGuestModal();
        if (rsvpModal.classList.contains('visible')) closeRsvpModal();
        if (qrModal.classList.contains('visible')) byId('qrClose').click();
        if (mobileNav.classList.contains('open')) closeMobileNav();
      }
      if (lightbox.classList.contains('visible') && event.key === 'ArrowRight') openGallery(galleryIndex + 1);
      if (lightbox.classList.contains('visible') && event.key === 'ArrowLeft') openGallery(galleryIndex - 1);
    });
  };

  /* -------------------------------- service worker ---------------------------------------- */
  const registerServiceWorker = () => {
    if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => { /* offline support optional */ });
      });
    }
  };

  /* ------------------------------------- boot ----------------------------------------------- */
  const startPageSystems = () => {
    if (startPageSystems.started) return;
    startPageSystems.started = true;
    createPetals();
    updateCountdown();
    updateEventStatuses();
    countdownTimer = window.setInterval(() => {
      updateCountdown();
      updateEventStatuses();
    }, 1000);
    observeCards();
    observeImageLoading();
    setGuestOnLoad();
    keyboardControls();
    updateScrollUI();
    initParallax();
  };

  const savedTheme = storage.get('bilalWeddingTheme');
  if (savedTheme) applyTheme(savedTheme);
  else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) applyTheme('dark');

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    motionPaused = true;
    body.classList.add('motion-paused');
    envelope.style.animation = 'none';
    envelope.classList.add('landed');
    landingCaption.classList.add('visible');
    autoOpenTimer = window.setTimeout(openInvitation, 700);
    byId('motionToggle').textContent = '▶';
    byId('motionToggle').setAttribute('aria-pressed', 'true');
  }

  waitForAssets();
  registerServiceWorker();

  window.addEventListener('pagehide', () => {
    window.clearInterval(countdownTimer);
    window.clearTimeout(autoOpenTimer);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  });
})();
