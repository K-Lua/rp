(function(){
	if (!window.ElementHandler) return;
	ElementHandler.register('menu', async function(el, env){
		const params = (el && el.params) || [];
		const titleRaw = params[0] ? String(params[0]) : 'menu';
		const title = titleRaw.replace(/^["']|["']$/g,'')
		const allowImmediateClose = params[1] === 'true' || String(params[1]).toLowerCase() === 'true';
		const rawContent = el && el.text != null ? String(el.text) : '';

		const container = document.createElement('div');
		container.className = 'attachment-inline';
		const box = document.createElement('div');
		box.className = 'attachment-box';
		box.setAttribute('role','button');
		box.setAttribute('tabindex','0');
		const labelEl = document.createElement('div');
		labelEl.className = 'attachment-label vt323-regular';
		labelEl.textContent = title;
		box.appendChild(labelEl);
		container.appendChild(box);
		const target = (env && env.terminalEl) ? env.terminalEl : document.body;
		target.appendChild(container);

		function openPopup(){
			const backdrop = document.createElement('div');
			backdrop.className = 'attachment-popup-backdrop';
			const popup = document.createElement('div');
			popup.className = 'attachment-popup';
			popup.style.display = 'flex';
			popup.style.flexDirection = 'column';
			popup.style.alignItems = 'stretch';

			const header = document.createElement('div');
			header.style.display = 'flex';
			header.style.alignItems = 'center';
			header.style.justifyContent = 'space-between';
			header.style.width = '100%';
			header.style.marginBottom = '0.5rem';
			const titleEl = document.createElement('div');
			titleEl.className = 'vt323-regular';
			titleEl.style.fontSize = '1rem';
			titleEl.textContent = title;
			header.appendChild(titleEl);

			const xBtn = document.createElement('button');
			xBtn.className = 'attachment-close';
			xBtn.setAttribute('aria-label','Close');
			xBtn.textContent = 'X';
			xBtn.style.color = '#ffffff';
			if (allowImmediateClose){
				header.appendChild(xBtn);
			} else {
				xBtn.style.display = 'none';
				header.appendChild(xBtn);
			}
			popup.appendChild(header);

			const popupTerminalWrap = document.createElement('div');
			popupTerminalWrap.className = 'popup-wrap';
			popupTerminalWrap.style.position = 'relative';
			popupTerminalWrap.style.width = '100%';
			popupTerminalWrap.style.flex = '1 1 auto';
			popupTerminalWrap.style.overflow = 'auto';
			const popupTerminal = document.createElement('div');
			popupTerminal.className = 'popup-console';
			popupTerminal.setAttribute('role','region');
			popupTerminal.setAttribute('aria-live','polite');
			popupTerminal.style.background = 'transparent';
			popupTerminal.style.padding = '0.5rem';
			popupTerminal.style.maxHeight = 'calc(80vh - 4rem)';
			popupTerminalWrap.appendChild(popupTerminal);
			popup.appendChild(popupTerminalWrap);

			const footer = document.createElement('div');
			footer.style.display = 'flex';
			footer.style.justifyContent = 'center';
			footer.style.marginTop = '0.5rem';
			popup.appendChild(footer);

			backdrop.appendChild(popup);

			const screenEl = document.getElementById('screen');
			(screenEl || document.body).appendChild(backdrop);

			const mainTerm = document.getElementById('terminal');
			if (mainTerm){
				const rect = mainTerm.getBoundingClientRect();
				if (rect.width > 0 && rect.height > 0){
					const maxW = Math.min(window.innerWidth * 0.95, rect.width);
					const maxH = Math.min(window.innerHeight * 0.9, rect.height + 80);
					popup.style.width = (typeof maxW === 'number') ? (maxW + 'px') : '';
					popup.style.height = (typeof maxH === 'number') ? (maxH + 'px') : '';
				}
			}

			let observer = null;
			try {
				observer = new MutationObserver(function(){
					try { popupTerminalWrap.scrollTop = popupTerminalWrap.scrollHeight; }catch(e){}
				});
				observer.observe(popupTerminal, { childList: true, subtree: true, characterData: true });
			}catch(e){ observer = null; }

			let closed = false;
			function closePopup(){
				if (closed) return;
				closed = true;
				if (observer) try{ observer.disconnect(); }catch(e){}
				document.removeEventListener('keydown', onKey);
				xBtn.removeEventListener('click', closePopup);
				backdrop.remove();
			}
			xBtn.addEventListener('click', closePopup);

			function printLine(tokens){
				const lineEl = document.createElement('div');
				lineEl.className = 'terminal-line';
				if (Array.isArray(tokens)){
					for (let i = 0; i < tokens.length; i++){
						const t = tokens[i];
						const span = document.createElement('span');
						const s = t.style || {};
						if (s.color) span.style.color = s.color;
						if (s.fontWeight) span.style.fontWeight = s.fontWeight;
						if (s.fontSize) span.style.fontSize = s.fontSize;
						span.textContent = t.text || '';
						lineEl.appendChild(span);
					}
				} else {
					lineEl.textContent = tokens;
				}
				popupTerminal.appendChild(lineEl);
				popupTerminalWrap.scrollTop = popupTerminalWrap.scrollHeight;
			}

			function typeToTerminalImmediate(textOrTokens){
				return new Promise((resolve)=>{
					printLine(textOrTokens);
					setTimeout(resolve, 0);
				});
			}

			function typeToTerminalWithRange(textOrTokens, minDelay, maxDelay){
				return new Promise((resolve)=>{
					const lineEl = document.createElement('div');
					lineEl.className = 'terminal-line';
					popupTerminal.appendChild(lineEl);

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
							popupTerminalWrap.scrollTop = popupTerminalWrap.scrollHeight;
							if (ch.trim() !== '' && env && env.pool1){
								try{ env.pool1.play(0.95 + Math.random() * 0.12); }catch(e){}
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
						popupTerminalWrap.scrollTop = popupTerminalWrap.scrollHeight;
						if (ch.trim() !== '' && env && env.pool1){
							try{ env.pool1.play(0.95 + Math.random() * 0.12); }catch(e){}
						}
						const delay = Math.round(minDelay + Math.random() * (maxDelay - minDelay));
						setTimeout(step, delay);
					};
					setTimeout(step, 10);
				});
			}

			const popupEnv = {
				printLine: printLine,
				typeToTerminal: typeToTerminalImmediate,
				typeToTerminalWithRange: typeToTerminalWithRange,
				terminalEl: popupTerminal,
				wait: (ms)=> new Promise((res)=> setTimeout(res, ms)),
				pool1: (env && env.pool1) ? env.pool1 : null
			};

			const lines = rawContent.split(/\r?\n/).map(s => s.trim()).filter(s => s.length > 0 && s.startsWith('<'));
			(async ()=>{
				for (let i = 0; i < lines.length; i++){
					const line = lines[i];
					await ElementHandler.renderLine(line, popupEnv);
				}
				if (!allowImmediateClose){
					const closeButton = document.createElement('button');
					closeButton.className = 'attachment-box vt323-regular';
					closeButton.textContent = 'Close';
					closeButton.style.marginTop = '0.5rem';
					closeButton.style.color = '#ffffff';
					footer.appendChild(closeButton);
					closeButton.addEventListener('click', closePopup);
				}
			})();

			backdrop.addEventListener('click', function(e){
				if (e.target === backdrop && allowImmediateClose) closePopup();
			});
			function onKey(e){
				if (e.key === 'Escape' && allowImmediateClose) closePopup();
			}
			document.addEventListener('keydown', onKey);
			backdrop.addEventListener('remove', function(){ document.removeEventListener('keydown', onKey); });
		}

		box.addEventListener('click', openPopup);
		box.addEventListener('keydown', function(e){
			if (e.key === 'Enter' || e.key === ' ') {
				openPopup();
				e.preventDefault();
			}
		});
	});
})();
