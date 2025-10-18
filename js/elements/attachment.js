(function(){
	if (!window.ElementHandler) return;
	ElementHandler.register('attachment', async function(el, env){
		const params = (el && el.params) || [];
		const imgPath = params[0] || '';
		const rawLabel = el && el.text != null ? el.text : '';
		const defaultTextColor = (params[3] && String(params[3]).trim()) ? params[3].trim() : '#e6eef8';

		function parseRects(raw){
			if (!raw || !String(raw).trim()) return [];
			const segs = String(raw).split(';').map(s=>s.trim()).filter(Boolean);
			const out = [];
			const coordRe = /(-?\d+)\s*[:,\s-\/]\s*(-?\d+)/g;
			for (let i = 0; i < segs.length; i++){
				let seg = segs[i];
				let label = null;
				if (seg.indexOf('|') !== -1){
					const parts = seg.split('|');
					seg = parts[0].trim();
					label = parts.slice(1).join('|').trim();
					if ((label.startsWith('"') && label.endsWith('"')) || (label.startsWith("'") && label.endsWith("'"))){
						label = label.slice(1,-1);
					}
				}
				const coords = [];
				let m;
				while ((m = coordRe.exec(seg)) !== null){
					coords.push({ x: Number(m[1]), y: Number(m[2]) });
				}
				if (coords.length >= 2){
					out.push({ x1: coords[0].x, y1: coords[0].y, x2: coords[1].x, y2: coords[1].y, text: label || '' });
				}
			}
			return out;
		}

		const container = document.createElement('div');
		container.className = 'attachment-inline';
		const box = document.createElement('div');
		box.className = 'attachment-box';
		box.setAttribute('role','button');
		box.setAttribute('tabindex','0');
		const labelEl = document.createElement('div');
		labelEl.className = 'attachment-label vt323-regular';
		labelEl.textContent = rawLabel ? '"' + rawLabel + '"' : '"attachment"';
		box.appendChild(labelEl);
		container.appendChild(box);
		const target = (env && env.terminalEl) ? env.terminalEl : document.body;
		target.appendChild(container);

		function openPopup(){
			const backdrop = document.createElement('div');
			backdrop.className = 'attachment-popup-backdrop';
			const popup = document.createElement('div');
			popup.className = 'attachment-popup';
			const closeBtn = document.createElement('button');
			closeBtn.className = 'attachment-close';
			closeBtn.setAttribute('aria-label','Close');
			closeBtn.textContent = 'X';
			const mediaWrap = document.createElement('div');
			mediaWrap.className = 'attachment-media';
			mediaWrap.style.position = 'relative';
			mediaWrap.style.display = 'inline-block';
			const img = document.createElement('img');
			img.className = 'attachment-image';
			img.alt = rawLabel || 'attachment';
			img.src = imgPath;
			const cap = document.createElement('div');
			cap.className = 'attachment-caption vt323-regular';
			cap.textContent = rawLabel || '';
			mediaWrap.appendChild(img);
			popup.appendChild(closeBtn);
			popup.appendChild(mediaWrap);
			popup.appendChild(cap);
			backdrop.appendChild(popup);
			document.body.appendChild(backdrop);

			let overlayCanvas = null;
			let overlayCtx = null;
			let lastMouse = null;

			function onMouseMove(e){
				lastMouse = { clientX: e.clientX, clientY: e.clientY };
			}
			img.addEventListener('mousemove', onMouseMove);

			const rects = parseRects(params[1]);
			let blockSize = 32;
			if (params[2]){
				const b = Number(params[2]);
				if (!Number.isNaN(b) && b > 0) blockSize = Math.floor(b);
			}
			const textColor = defaultTextColor;
			const scramblerEnabled = Array.isArray(params) && params.some(function(p){
				if (!p && p !== 0) return false;
				const s = String(p).trim().toLowerCase();
				return s === 'scrambler' || s === 'true';
			});

			function createOverlay(){
				if (overlayCanvas) return;
				overlayCanvas = document.createElement('canvas');
				overlayCanvas.className = 'attachment-overlay';
				overlayCanvas.style.position = 'absolute';
				overlayCanvas.style.left = '0';
				overlayCanvas.style.top = '0';
				overlayCanvas.style.pointerEvents = 'none';
				overlayCanvas.style.zIndex = '30';
				mediaWrap.appendChild(overlayCanvas);
				overlayCtx = overlayCanvas.getContext('2d');
				const iw = Math.max(1, img.clientWidth || 1);
				const ih = Math.max(1, img.clientHeight || 1);
				overlayCanvas.width = iw;
				overlayCanvas.height = ih;
				overlayCanvas.style.width = iw + 'px';
				overlayCanvas.style.height = ih + 'px';
			}

			function resizeOverlay(){
				if (!overlayCanvas) return;
				const w = Math.max(1, img.clientWidth || overlayCanvas.width);
				const h = Math.max(1, img.clientHeight || overlayCanvas.height);
				if (overlayCanvas.width !== w || overlayCanvas.height !== h){
					overlayCanvas.width = w;
					overlayCanvas.height = h;
					overlayCanvas.style.width = w + 'px';
					overlayCanvas.style.height = h + 'px';
				}
			}

			function clearOverlay(){
				if (overlayCtx && overlayCanvas){
					overlayCtx.clearRect(0,0,overlayCanvas.width, overlayCanvas.height);
				}
			}

			function drawRectWithTextOnce(r, size, text, color){
				if (!overlayCtx || !overlayCanvas) return;
				const natW = img.naturalWidth || overlayCanvas.width;
				const natH = img.naturalHeight || overlayCanvas.height;
				const scaleX = overlayCanvas.width / natW;
				const scaleY = overlayCanvas.height / natH;
				const x1 = Math.round(r.x1 * scaleX);
				const y1 = Math.round(r.y1 * scaleY);
				const x2 = Math.round(r.x2 * scaleX);
				const y2 = Math.round(r.y2 * scaleY);
				const left = Math.min(x1, x2);
				const top = Math.min(y1, y2);
				const width = Math.max(1, Math.abs(x2 - x1));
				const height = Math.max(1, Math.abs(y2 - y1));
				overlayCtx.fillStyle = '#000';
				overlayCtx.fillRect(left, top, width, height);
				overlayCtx.strokeStyle = 'rgba(255,255,255,0.06)';
				overlayCtx.lineWidth = 1;
				overlayCtx.strokeRect(left + 0.5, top + 0.5, Math.max(1, width - 1), Math.max(1, height - 1));
				if (text){
					const fontSize = Math.max(10, Math.floor(Math.min(width, height) * 0.2));
					overlayCtx.font = fontSize + 'px VT323, monospace';
					overlayCtx.fillStyle = color || '#e6eef8';
					overlayCtx.textAlign = 'center';
					overlayCtx.textBaseline = 'middle';
					overlayCtx.fillText(text, left + width / 2, top + height / 2);
				}
			}

			let particles = [];
			let lastTime = 0;
			let rafId = null;
			let spawnAccumulator = 0;

			function spawnParticle(cx, cy, left, top, width, height){
				const side = Math.floor(Math.random() * 4);
				let x = cx;
				let y = cy;
				if (side === 0){
					x = left + Math.random() * width;
					y = top + (Math.random() * 3);
				} else if (side === 1){
					x = left + width - (Math.random() * 3);
					y = top + Math.random() * height;
				} else if (side === 2){
					x = left + Math.random() * width;
					y = top + height - (Math.random() * 3);
				} else {
					x = left + (Math.random() * 3);
					y = top + Math.random() * height;
				}
				const vx = (Math.random() - 0.5) * 0.6;
				const vy = (Math.random() - 0.5) * 0.6;
				const life = 1000 + Math.random() * 800;
				const size = 2 + Math.random() * Math.min(6, blockSize * 0.22);
				particles.push({ x, y, vx, vy, age: 0, life, size });
			}

			function wrapTextLines(ctx, text, maxWidth){
				const words = text.split(/\s+/);
				const lines = [];
				let cur = '';
				for (let i = 0; i < words.length; i++){
					const w = words[i];
					const test = cur ? (cur + ' ' + w) : w;
					const measure = ctx.measureText(test).width;
					if (measure > maxWidth && cur){
						lines.push(cur);
						cur = w;
					} else {
						cur = test;
					}
				}
				if (cur) lines.push(cur);
				return lines;
			}

			function renderFrame(ts){
				if (!overlayCtx || !overlayCanvas) return;
				resizeOverlay();
				if (!lastTime) lastTime = ts;
				const dt = Math.min(40, ts - lastTime);
				lastTime = ts;
				overlayCtx.clearRect(0,0,overlayCanvas.width, overlayCanvas.height);
				const natW = img.naturalWidth || overlayCanvas.width;
				const natH = img.naturalHeight || overlayCanvas.height;
				const scaleX = overlayCanvas.width / natW;
				const scaleY = overlayCanvas.height / natH;

				for (let i = 0; i < rects.length; i++){
					const r = rects[i];
					const x1 = Math.round(r.x1 * scaleX);
					const y1 = Math.round(r.y1 * scaleY);
					const x2 = Math.round(r.x2 * scaleX);
					const y2 = Math.round(r.y2 * scaleY);
					const left = Math.min(x1, x2);
					const top = Math.min(y1, y2);
					const width = Math.max(1, Math.abs(x2 - x1));
					const height = Math.max(1, Math.abs(y2 - y1));
					overlayCtx.fillStyle = '#000';
					overlayCtx.fillRect(left, top, width, height);
					overlayCtx.strokeStyle = 'rgba(255,255,255,0.06)';
					overlayCtx.lineWidth = 1;
					overlayCtx.strokeRect(left + 0.5, top + 0.5, Math.max(1, width - 1), Math.max(1, height - 1));
				}

				if (scramblerEnabled){
					const spawnRatePerSec = 30;
					spawnAccumulator += dt;
					const spawnInterval = 1000 / spawnRatePerSec;
					while (spawnAccumulator >= spawnInterval){
						spawnAccumulator -= spawnInterval;
						if (rects && rects.length){
							const r0 = rects[0];
							const rx1 = Math.round(r0.x1 * scaleX);
							const ry1 = Math.round(r0.y1 * scaleY);
							const rx2 = Math.round(r0.x2 * scaleX);
							const ry2 = Math.round(r0.y2 * scaleY);
							const left = Math.min(rx1, rx2);
							const top = Math.min(ry1, ry2);
							const width = Math.max(1, Math.abs(rx2 - rx1));
							const height = Math.max(1, Math.abs(ry2 - ry1));
							const cx = left + width / 2;
							const cy = top + height / 2;
							spawnParticle(cx, cy, left, top, width, height);
						}
					}
					for (let i = particles.length - 1; i >= 0; i--){
						const p = particles[i];
						p.age += dt;
						if (p.age >= p.life){
							particles.splice(i,1);
							continue;
						}
						p.x += p.vx * (dt * 0.06) + (Math.random() - 0.5) * 0.4;
						p.y += p.vy * (dt * 0.06) + (Math.random() - 0.5) * 0.4;
						overlayCtx.fillStyle = 'rgb(0,0,0)';
						const s = Math.max(1, Math.round(p.size));
						overlayCtx.fillRect(p.x - s/2, p.y - s/2, s, s);
					}
				}

				if (rects && rects.length){
					const r0 = rects[0];
					const x1 = Math.round(r0.x1 * scaleX);
					const y1 = Math.round(r0.y1 * scaleY);
					const x2 = Math.round(r0.x2 * scaleX);
					const y2 = Math.round(r0.y2 * scaleY);
					const left = Math.min(x1, x2);
					const top = Math.min(y1, y2);
					const width = Math.max(1, Math.abs(x2 - x1));
					const height = Math.max(1, Math.abs(y2 - y1));
					const padding = 8;
					const maxTextWidth = Math.max(20, width - padding * 2);
					const baseFont = Math.max(12, Math.floor(Math.min(width, height) * 0.16));
					overlayCtx.textAlign = 'center';
					overlayCtx.textBaseline = 'middle';
					overlayCtx.font = baseFont + 'px VT323, monospace';
					const multi = 'COGNITOHAZARD';
					const lines = wrapTextLines(overlayCtx, multi, maxTextWidth);
					const totalHeight = lines.length * baseFont * 1.1;
					const startY = top + height / 2 - totalHeight / 2 + baseFont / 2;

					for (let li = 0; li < lines.length; li++){
						const line = lines[li];
						const y = startY + li * baseFont * 1.1;
						overlayCtx.fillStyle = 'rgba(180,0,0,1)';
						overlayCtx.fillText(line, left + width / 2, y);
						overlayCtx.fillStyle = 'rgba(255,60,60,0.22)';
						overlayCtx.fillText(line, left + width / 2 - 1.6, y + 0.6);
						overlayCtx.fillStyle = 'rgba(0,180,220,0.22)';
						overlayCtx.fillText(line, left + width / 2 + 1.6, y - 0.6);
					}
				}

				rafId = requestAnimationFrame(renderFrame);
			}

			function applyAllMarks(){
				if (!rects || rects.length === 0){
					return;
				}
				createOverlay();
				resizeOverlay();
				clearOverlay();
				for (let i = 0; i < rects.length; i++){
					const r = rects[i];
					const labelForRect = (r.text && r.text.length) ? r.text : '';
					drawRectWithTextOnce(r, blockSize, labelForRect, textColor);
				}
				if (scramblerEnabled){
					particles = [];
					lastTime = 0;
					spawnAccumulator = 0;
					if (rafId) cancelAnimationFrame(rafId);
					rafId = requestAnimationFrame(renderFrame);
				}
			}

			function ensureDefaultRectIfNeeded(){
				if (rects && rects.length) return;
				const natW = img.naturalWidth || overlayCanvas.width || 800;
				const natH = img.naturalHeight || overlayCanvas.height || 600;
				const w = Math.max(40, Math.floor(natW * 0.35));
				const h = Math.max(24, Math.floor(natH * 0.18));
				const cx = Math.floor(natW / 2);
				const cy = Math.floor(natH / 2);
				const left = Math.max(0, cx - Math.floor(w / 2));
				const top = Math.max(0, cy - Math.floor(h / 2));
				rects = [{ x1: left, y1: top, x2: left + w, y2: top + h, text: '' }];
			}

			function onImgLoad(){
				createOverlay();
				resizeOverlay();
				if (!rects || rects.length === 0){
					ensureDefaultRectIfNeeded();
				}
				applyAllMarks();
			}
			function onImgError(){
				createOverlay();
				if (!overlayCanvas.width || !overlayCanvas.height){
					overlayCanvas.width = 800;
					overlayCanvas.height = 600;
					overlayCanvas.style.width = overlayCanvas.width + 'px';
					overlayCanvas.style.height = overlayCanvas.height + 'px';
				}
				if (!rects || rects.length === 0){
					ensureDefaultRectIfNeeded();
				}
				applyAllMarks();
			}
			img.addEventListener('load', onImgLoad);
			img.addEventListener('error', onImgError);
			const onWindowResize = ()=>{ resizeOverlay(); };
			window.addEventListener('resize', onWindowResize);

			setTimeout(()=>{
				if (img.complete){
					if (img.naturalWidth && img.naturalHeight){
						onImgLoad();
					} else {
						onImgError();
					}
				}
			}, 0);

			function onKey(e){
				const k = String(e.key || '');
				if (k === 'Escape'){
					closePopup();
					return;
				}
				if (k.toLowerCase() === 'p'){
					const rect = img.getBoundingClientRect();
					if (lastMouse){
						const relX = Math.round((lastMouse.clientX - rect.left) / (rect.width / img.naturalWidth || 1));
						const relY = Math.round((lastMouse.clientY - rect.top) / (rect.height / img.naturalHeight || 1));
						cap.textContent = rawLabel + '  -  pos: ' + relX + ',' + relY;
					} else {
						cap.textContent = rawLabel + '  -  pos: n/a';
					}
				}
			}
			document.addEventListener('keydown', onKey);

			function closePopup(){
				img.removeEventListener('mousemove', onMouseMove);
				img.removeEventListener('load', onImgLoad);
				img.removeEventListener('error', onImgError);
				document.removeEventListener('keydown', onKey);
				window.removeEventListener('resize', onWindowResize);
				if (rafId) cancelAnimationFrame(rafId);
				if (overlayCanvas && overlayCanvas.parentNode) overlayCanvas.parentNode.removeChild(overlayCanvas);
				backdrop.remove();
			}
			closeBtn.addEventListener('click', closePopup);
			backdrop.addEventListener('click', function(e){
				if (e.target === backdrop) closePopup();
			});
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
