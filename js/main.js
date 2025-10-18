document.addEventListener('DOMContentLoaded',function(){
	const startup = document.getElementById('startupAudio');
	const loop = document.getElementById('loopAudio');
	loop.loop = false;
	loop.volume = 0;
	let crossfaded = false;
	let loopFadingOut = false;

	let startPromptEl = null;
	const createStartPrompt = ()=>{
		if (startPromptEl) return;
		const el = document.createElement('div');
		el.id = 'startPrompt';
		el.textContent = 'Click to login....';
		el.style.position = 'fixed';
		el.style.left = '50%';
		el.style.top = '50%';
		el.style.transform = 'translate(-50%,-50%)';
		el.style.padding = '12px 20px';
		el.style.background = 'rgba(0,0,0,0.75)';
		el.style.color = 'white';
		el.style.fontFamily = 'VT323, monospace, sans-serif';
		el.style.fontSize = '20px';
		el.style.borderRadius = '6px';
		el.style.zIndex = '10000';
		el.style.cursor = 'pointer';
		document.body.appendChild(el);
		startPromptEl = el;
		const removeOnce = ()=>{
			if (startPromptEl){
				try{ startPromptEl.remove(); }catch(e){}
				startPromptEl = null;
			}
		};
		el.addEventListener('click', removeOnce, { once:true });
	};
	const removeStartPrompt = ()=>{
		if (!startPromptEl) return;
		try{ startPromptEl.remove(); }catch(e){}
		startPromptEl = null;
	};

	const getFadeDurations = ()=>{
		const ld = Number.isFinite(loop.duration) ? loop.duration : NaN;
		const sd = Number.isFinite(startup.duration) ? startup.duration : NaN;
		let fadeIn = 2.5;
		let fadeOut = 0.8;
		if (Number.isFinite(ld)){
			fadeIn = Math.max(0.5, ld * 0.25);
			fadeOut = Math.max(0.4, ld * 0.1);
		}
		if (Number.isFinite(sd)){
			fadeIn = Math.min(fadeIn, sd);
		}
		return { fadeIn, fadeOut };
	};
	const primeLoop = ()=>{
		loop.muted = true;
		const p = loop.play();
		Promise.resolve(p).then(()=>{ loop.pause(); loop.currentTime = 0; loop.muted = false; }).catch(()=>{ loop.muted = false; });
	};
	const scheduleLoopFadeOut = ()=>{
		if (loopFadingOut) return;
		const { fadeOut } = getFadeDurations();
		const remaining = loop.duration - loop.currentTime;
		if (!isFinite(remaining)) return;
		if (remaining <= fadeOut){
			loopFadingOut = true;
			const startTime = performance.now();
			const startVol = loop.volume;
			const fade = ()=>{
				const t = (performance.now() - startTime) / (fadeOut * 1000);
				if (t >= 1){
					loop.volume = 0;
					loop.pause();
					loop.currentTime = 0;
					loopFadingOut = false;
					return;
				}
				loop.volume = Math.max(0, startVol * (1 - t));
				requestAnimationFrame(fade);
			};
			requestAnimationFrame(fade);
		}
	};
	const crossfade = ()=>{
		if (crossfaded) return;
		crossfaded = true;
		const { fadeIn } = getFadeDurations();
		const remainingBefore = Number.isFinite(startup.duration) ? Math.max(0, startup.duration - startup.currentTime) : NaN;
		loop.currentTime = 0;
		loop.volume = 0;
		loop.muted = false;
		const startPlay = loop.play().catch(()=>{});
		const startTime = performance.now();
		const fade = ()=>{
			const t = (performance.now() - startTime) / (fadeIn * 1000);
			const tt = Math.min(1, Math.max(0, t));
			if (tt >= 1){
				loop.volume = 1;
				startup.volume = 0;
				startup.pause();
				if (!typewriterScheduled && Number.isFinite(remainingBefore)){
					typewriterScheduled = true;
					setTimeout(()=>{ startTypewriter(); }, Math.max(0, Math.round(remainingBefore * 1000)));
				}
				loop.addEventListener('timeupdate', scheduleLoopFadeOut);
				return;
			}
			loop.volume = tt;
			startup.volume = 1 - tt;
			requestAnimationFrame(fade);
		};
		Promise.resolve(startPlay).then(()=>{ requestAnimationFrame(fade); }).catch(()=>{ requestAnimationFrame(fade); });
	};
	let attachUnlock = ()=>{
		const unlock = ()=>{
			primePools();
			startup.play().catch(()=>{});
			primeLoop();
			removeStartPrompt();
			window.removeEventListener('click', unlock);
			window.removeEventListener('keydown', unlock);
		};
		window.addEventListener('click', unlock, { once:true });
		window.addEventListener('keydown', unlock, { once:true });
	};

	const onTimeUpdate = ()=>{
		if (crossfaded) return;
		const remaining = startup.duration - startup.currentTime;
		if (!isFinite(remaining)) return;
		const { fadeIn } = getFadeDurations();
		if (remaining <= fadeIn) crossfade();
	};
	startup.addEventListener('timeupdate', onTimeUpdate);
	primeLoop();
	startup.play().catch(attachUnlock);

	const typeSoundSrcs = [];
	let typewriterStarted = false;
	let typewriterScheduled = false;
	const overlayEl = document.querySelector('.overlay-text');
	const visibleSpan = overlayEl ? overlayEl.querySelector('.visible-text') : null;
	if (visibleSpan){
		visibleSpan.textContent = '';
		visibleSpan.setAttribute('data-visible','');
	}

	let navHintEl = null;
	let navHintLoop = false;
	let navHintTimers = [];

	const createNavHint = ()=>{
		if (navHintEl) return;
		const container = document.getElementById('screen') || document.body;
		const el = document.createElement('div');
		el.id = 'navHint';
		el.textContent = 'Arrow keys to navigate, Enter to select';
		el.style.position = 'fixed';
		el.style.left = '50%';
		el.style.transform = 'translateX(-50%)';
		el.style.bottom = '18px';
		el.style.padding = '6px 12px';
		el.style.background = 'rgba(0,0,0,0.6)';
		el.style.color = 'white';
		el.style.fontFamily = 'VT323, monospace, sans-serif';
		el.style.fontSize = '16px';
		el.style.borderRadius = '4px';
		el.style.opacity = '0';
		el.style.pointerEvents = 'none';
		el.style.zIndex = '9999';
		container.appendChild(el);
		navHintEl = el;
	};

	const rafFade = (el, from, to, dur, done)=>{
		const start = performance.now();
		const step = (now)=>{
			const t = Math.min(1, (now - start) / dur);
			el.style.opacity = String(from + (to - from) * t);
			if (t < 1) requestAnimationFrame(step); else if (done) done();
		};
		requestAnimationFrame(step);
	};

	const startNavHint = ()=>{
		if (navHintLoop) return;
		createNavHint();
		navHintLoop = true;
		const loopFn = ()=>{
			if (!navHintLoop || !navHintEl) return;
			rafFade(navHintEl, 0, 1, 600, ()=>{
				navHintTimers.push(setTimeout(()=>{
					if (!navHintLoop || !navHintEl) return;
					rafFade(navHintEl, 1, 0, 600, ()=>{
						navHintTimers.push(setTimeout(()=>{
							loopFn();
						}, 600));
					});
				}, 2000));
			});
		};
		loopFn();
	};

	const stopNavHint = ()=>{
		navHintLoop = false;
		for (let i = 0; i < navHintTimers.length; i++) clearTimeout(navHintTimers[i]);
		navHintTimers = [];
		if (navHintEl){
			rafFade(navHintEl, Number(navHintEl.style.opacity) || 1, 0, 300, ()=>{
				try{ navHintEl.remove(); }catch(e){}
				navHintEl = null;
			});
		}
	};

	const terminalEl = document.getElementById('terminal');

	const wait = (ms)=> new Promise((res)=> setTimeout(res, ms));

	const typeToTerminal = (textOrTokens, lineClass='terminal-line')=>{
		return new Promise((resolve)=>{
			if (!terminalEl) return resolve();
			const lineEl = document.createElement('div');
			lineEl.className = lineClass;
			terminalEl.appendChild(lineEl);

			if (Array.isArray(textOrTokens)){
				let tokenIndex = 0;
				let charIndex = 0;
				const step = ()=>{
					if (tokenIndex >= textOrTokens.length){
						return resolve();
					}
					const token = textOrTokens[tokenIndex];
					if (!token._el){
						const span = document.createElement('span');
						const s = token.style || {};
						if (s.color) span.style.color = s.color;
						if (s.fontWeight) span.style.fontWeight = s.fontWeight;
						if (s.fontSize) span.style.fontSize = s.fontSize;
						lineEl.appendChild(span);
						token._el = span;
						charIndex = 0;
					}
					const t = token.text || '';
					if (charIndex >= t.length){
						tokenIndex++;
						charIndex = 0;
						setTimeout(step, 0);
						return;
					}
					const ch = t.charAt(charIndex++);
					token._el.textContent += ch;
					if (ch.trim() !== ''){
						try{ pool1.play(0.95 + Math.random() * 0.12); }catch(e){}
					}
					const delay = 18 + Math.random() * 60;
					setTimeout(step, delay);
				};
				setTimeout(step, 10);
				return;
			}

			let i = 0;
			const step = ()=>{
				if (i >= textOrTokens.length){
					return resolve();
				}
				const ch = textOrTokens[i++];
				lineEl.textContent += ch;
				if (ch.trim() !== ''){
					try{ pool1.play(0.95 + Math.random() * 0.12); }catch(e){}
				}
				const delay = 18 + Math.random() * 60;
				setTimeout(step, delay);
			};
			setTimeout(step, 10);
		});
	};

	const appendAccessDenied = ()=>{
		if (!terminalEl) return;
		const box = document.createElement('div');
		box.className = 'access-denied';
		box.textContent = 'Access Denied';
		terminalEl.appendChild(box);
		terminalEl.appendChild(document.createElement('br'));
	};

	let consoleSequenceStarted = false;
	const files = [
		{ id: 1, name: "KLua < Foundation Log >", locked: true },
		{ id: 2, name: "███████ Lua < Chaos Insurgency File >", locked: true },
		{ id: 3, name: "████████ Blua < GOC Personel File >", locked: false }
	];
	let selectedIndex = 0;

	const showDeniedOverlay = ()=>{
		const overlay = document.getElementById('deniedOverlay');
		if (!overlay) return;
		overlay.classList.remove('fading');
		overlay.classList.add('visible');
		setTimeout(()=>{
			overlay.classList.add('fading');
			overlay.classList.remove('visible');
		}, 1000);
	};

	const renderFileList = async ()=>{
		if (!terminalEl) return;
		terminalEl.innerHTML = '';
		const ul = document.createElement('ul');
		ul.className = 'file-list';
		terminalEl.appendChild(ul);

		const typeAudio = typeSoundSrcs[0] ? new Audio(typeSoundSrcs[0]) : null;
		if (typeAudio){
			typeAudio.preload = 'auto';
			typeAudio.volume = 0.85;
		}

		const items = files.map((f, idx)=>{
			const li = document.createElement('li');
			li.className = 'file-item';
			if (idx === selectedIndex) li.classList.add('selected');
			const marker = document.createElement('span');
			marker.className = 'marker';
			marker.textContent = '>';
			const label = document.createElement('span');
			label.className = 'label vt323-regular';
			li.appendChild(marker);
			li.appendChild(label);
			ul.appendChild(li);
			return { label, text: f.name, pos: 0 };
		});

		const tickDelay = 100;
		while (true){
			let progressed = false;
			for (let k = 0; k < items.length; k++){
				const it = items[k];
				if (it.pos < it.text.length){
					it.label.textContent += it.text.charAt(it.pos++);
					progressed = true;
				}
			}
			if (!progressed) break;
			if (typeAudio){
				try{ typeAudio.currentTime = 0; typeAudio.play().catch(()=>{}); }catch(e){}
			}
			await new Promise((res)=> setTimeout(res, tickDelay));
		}
		await new Promise((res)=> setTimeout(res, 200));
	};

	const updateSelection = ()=>{
		if (!terminalEl) return;
		const items = terminalEl.querySelectorAll('.file-item');
		for (let i = 0; i < items.length; i++) {
			if (i === selectedIndex) {
				items[i].classList.add('selected');
			} else {
				items[i].classList.remove('selected');
			}
		}
	};

	const loadGOCData = async ()=>{
		if (typeof window !== 'undefined' && typeof window.__goc_data === 'string'){
			return String(window.__goc_data || '').trim();
		}
		return '';
	};

	const typeToTerminalWithRange = (textOrTokens, minDelay, maxDelay, lineClass='terminal-line')=>{
		return new Promise((resolve)=>{
			if (!terminalEl) return resolve();
			const lineEl = document.createElement('div');
			lineEl.className = lineClass;
			terminalEl.appendChild(lineEl);

			if (Array.isArray(textOrTokens)){
				let tokenIndex = 0;
				let charIndex = 0;
				const step = ()=>{
					if (tokenIndex >= textOrTokens.length){
						return resolve();
					}
					const token = textOrTokens[tokenIndex];
					if (!token._el){
						const span = document.createElement('span');
						const s = token.style || {};
						if (s.color) span.style.color = s.color;
						if (s.fontWeight) span.style.fontWeight = s.fontWeight;
						if (s.fontSize) span.style.fontSize = s.fontSize;
						lineEl.appendChild(span);
						token._el = span;
						charIndex = 0;
					}
					const t = token.text || '';
					if (charIndex >= t.length){
						tokenIndex++;
						charIndex = 0;
						setTimeout(step, 0);
						return;
					}
					const ch = t.charAt(charIndex++);
					token._el.textContent += ch;
					if (ch.trim() !== ''){
						try{ pool1.play(0.95 + Math.random() * 0.12); }catch(e){}
					}
					const delay = Math.round(minDelay + Math.random() * (maxDelay - minDelay));
					setTimeout(step, delay);
				};
				setTimeout(step, 10);
				return;
			}

			let i = 0;
			const step = ()=>{
				if (i >= textOrTokens.length){
					return resolve();
				}
				const ch = textOrTokens[i++];
				lineEl.textContent += ch;
				if (ch.trim() !== ''){
					try{ pool1.play(0.95 + Math.random() * 0.12); }catch(e){}
				}
				const delay = Math.round(minDelay + Math.random() * (maxDelay - minDelay));
				setTimeout(step, delay);
			};
			setTimeout(step, 10);
		});
	};

	const printLine = (textOrTokens, lineClass='terminal-line')=>{
		if (!terminalEl) return;
		const lineEl = document.createElement('div');
		lineEl.className = lineClass;
		if (Array.isArray(textOrTokens)){
			for (let i = 0; i < textOrTokens.length; i++){
				const t = textOrTokens[i];
				const span = document.createElement('span');
				const s = t.style || {};
				if (s.color) span.style.color = s.color;
				if (s.fontWeight) span.style.fontWeight = s.fontWeight;
				if (s.fontSize) span.style.fontSize = s.fontSize;
				span.textContent = t.text || '';
				lineEl.appendChild(span);
			}
		} else {
			lineEl.textContent = textOrTokens;
		}
		terminalEl.appendChild(lineEl);
	};
	
	const renderGOCContent = async (data)=>{
		if (!data) return;
		const lines = data.split(/\r?\n/);
		for (let ln = 0; ln < lines.length; ln++){
			let raw = lines[ln];
			let parsed = ElementHandler.parseLine(raw);
			if (parsed && (parsed.text === '' || parsed.text == null)){
				const mOpener = String(raw || '').trim().match(/\)\s*(['"])\s*$/);
				if (mOpener){
					const quoteChar = mOpener[1];
					let j = ln;
					let block = raw;
					let found = false;
					while (j + 1 < lines.length){
						j++;
						block += '\n' + lines[j];
						if (String(lines[j] || '').trim() === quoteChar){
							found = true;
							break;
						}
					}
					if (found){
						raw = block;
						ln = j;
						parsed = ElementHandler.parseLine(raw);
					}
				}
			}
			if (!parsed && raw.trim().startsWith('<')){
				let j = ln;
				let block = raw;
				while (j + 1 < lines.length){
					j++;
					block += '\n' + lines[j];
					if (ElementHandler.parseLine(block)){
						raw = block;
						ln = j;
						parsed = true;
						break;
					}
				}
			}
			await ElementHandler.renderLine(raw, {
				typeToTerminal,
				typeToTerminalWithRange,
				printLine,
				pool1,
				wait,
				terminalEl
			});
			await wait(80);
		}
	};

	const startConsoleSequence = async ()=>{
		if (!terminalEl || consoleSequenceStarted) return;
		consoleSequenceStarted = true;
		terminalEl.innerHTML = '';
		await renderFileList();
		startNavHint();
		const handleKeydown = async (e)=>{
			if (e.key === 'ArrowUp'){
				e.preventDefault();
				if (selectedIndex > 0){
					selectedIndex--;
					updateSelection();
					try{ pool1.play(0.95 + Math.random() * 0.12); }catch(err){}
				}
			} else if (e.key === 'ArrowDown'){
				e.preventDefault();
				if (selectedIndex < files.length - 1){
					selectedIndex++;
					updateSelection();
					try{ pool1.play(0.95 + Math.random() * 0.12); }catch(err){}
				}
			} else if (e.key === 'Enter'){
				e.preventDefault();
				try{ pool1.play(1.0); }catch(err){}
				const selected = files[selectedIndex];
				if (selected.locked){
					showDeniedOverlay();
					return;
				}
				stopNavHint();
				window.removeEventListener('keydown', handleKeydown);
				await wait(300);
				const data = await loadGOCData();
				terminalEl.innerHTML = '';
				await renderGOCContent(data);
			}
		};

		window.addEventListener('keydown', handleKeydown);
	};

	const makePool = (src, count)=>{
		if (!src){
			return {
				play(){
					return { audio: null, promise: Promise.resolve() };
				},
				elements: []
			};
		}
		const els = [];
		for (let i = 0; i < count; i++){
			const a = new Audio(src);
			a.preload = 'auto';
			a.volume = 0.85;
			els.push(a);
		}
		let idx = 0;
		return {
			play(rate){
				const a = els[idx];
				idx = (idx + 1) % els.length;
				try{ a.pause(); a.currentTime = 0; }catch(e){}
				a.playbackRate = rate;
				const promise = a.play();
				return { audio: a, promise };
			},
			elements: els
		};
	};

	const pool1 = makePool(typeSoundSrcs[0], 14);

	const primePools = ()=>{
		const primeList = pool1.elements;
		for (let i = 0; i < primeList.length; i++){
			const a = primeList[i];
			try{ a.currentTime = 0; }catch(e){}
			a.muted = true;
			a.play().then(()=>{
				try{ a.pause(); a.currentTime = 0; }catch(e){}
				a.muted = false;
			}).catch(()=>{
				a.muted = false;
			});
		}
	};

	startup.addEventListener('play', ()=>{ removeStartPrompt(); }, { once:true });
	const startTypewriter = ()=>{
		if (!overlayEl || typewriterStarted) return;
		typewriterStarted = true;
		const text = overlayEl.getAttribute('data-text') || overlayEl.textContent || '';
		if (visibleSpan) visibleSpan.textContent = '';
		overlayEl.setAttribute('data-remaining', text);
		if (visibleSpan) visibleSpan.setAttribute('data-visible','');
		let i = 0;
		const next = ()=>{
			if (i >= text.length){
				overlayEl.removeAttribute('data-remaining');
				setTimeout(()=>{
					const reverseDelayBase = 30;
					const reverseDelayRand = 90;
					const doDelete = ()=>{
						const current = visibleSpan ? visibleSpan.textContent || '' : '';
						if (current.length === 0){
							if (visibleSpan) visibleSpan.removeAttribute('data-visible');
							setTimeout(()=>{ startConsoleSequence(); }, 2000);
							return;
						}
						const newText = current.slice(0, -1);
						if (visibleSpan) visibleSpan.textContent = newText;
						if (visibleSpan) visibleSpan.setAttribute('data-visible', newText);
						const delay = reverseDelayBase + Math.random() * reverseDelayRand;
						setTimeout(doDelete, delay);
					};
					setTimeout(doDelete, 600);
				}, 600);
				return;
			}
			overlayEl.setAttribute('data-remaining', text.slice(i));
			const ch = text[i++];
			const delay = 30 + Math.random() * 90;
			if (ch.trim() === ''){
				if (visibleSpan) visibleSpan.textContent += ch;
				if (visibleSpan) visibleSpan.setAttribute('data-visible', visibleSpan.textContent);
				setTimeout(next, delay);
				return;
			}
			const rate = 0.95 + Math.random() * 0.12;
			const pool = pool1;
			const res = pool.play(rate);
			const a = res && res.audio ? res.audio : null;
			const p = res && res.promise ? res.promise : null;
			let appended = false;
			const finish = ()=>{
				if (appended) return;
				appended = true;
				if (visibleSpan) visibleSpan.textContent += ch;
				if (visibleSpan) visibleSpan.setAttribute('data-visible', visibleSpan.textContent);
				setTimeout(next, delay);
			};
			if (a){
				a.addEventListener('playing', finish, { once:true });
				if (p && typeof p.then === 'function'){
					p.catch(()=>{ setTimeout(finish, 0); });
				} else {
					setTimeout(finish, 300);
				}
				setTimeout(finish, 300);
			} else if (p && typeof p.then === 'function'){
				p.then(finish).catch(finish);
			} else {
				finish();
			}
		};
		Promise.resolve().then(next);
	};
	startup.addEventListener('ended', ()=>{
		startTypewriter();
		if (!crossfaded) crossfade();
	}, { once:true });
	createStartPrompt();
});
