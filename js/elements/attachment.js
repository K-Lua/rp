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

			function createOverlay(){
				if (overlayCanvas) return;
				overlayCanvas = document.createElement('canvas');
				overlayCanvas.className = 'attachment-overlay';
				overlayCanvas.style.position = 'absolute';
				overlayCanvas.style.left = '0';
				overlayCanvas.style.top = '0';
				overlayCanvas.style.pointerEvents = 'none';
				mediaWrap.appendChild(overlayCanvas);
				overlayCtx = overlayCanvas.getContext('2d');
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

			function drawRectWithText(r, size, text, color){
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
				overlayCtx.fillStyle = 'rgba(0,0,0,0.98)';
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

			function applyAllMarks(){
				if (!rects || rects.length === 0) return;
				createOverlay();
				resizeOverlay();
				clearOverlay();
				for (let i = 0; i < rects.length; i++){
					const r = rects[i];
					const labelForRect = (r.text && r.text.length) ? r.text : '';
					drawRectWithText(r, blockSize, labelForRect, textColor);
				}
			}

			function onImgLoad(){
				createOverlay();
				resizeOverlay();
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
				applyAllMarks();
			}
			img.addEventListener('load', onImgLoad);
			img.addEventListener('error', onImgError);

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
						console.log('Relative (natural) mouse position:', relX, relY);
						cap.textContent = rawLabel + '  —  pos: ' + relX + ',' + relY;
					} else {
						console.log('No mouse position recorded over image yet');
						cap.textContent = rawLabel + '  —  pos: n/a';
					}
				}
			}
			document.addEventListener('keydown', onKey);

			function closePopup(){
				img.removeEventListener('mousemove', onMouseMove);
				img.removeEventListener('load', onImgLoad);
				img.removeEventListener('error', onImgError);
				document.removeEventListener('keydown', onKey);
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
