(function(){
	if (!window.ElementHandler) return;
	function parseInline(text){
		if (!text) return [{ text: '' }];
		const out = [];
		const re = /(color|bold|size)\(\s*(?:(?:"([^"]*)"|'([^']*)')|([^),]+))\s*(?:,\s*(?:(?:"([^"]*)"|'([^']*)')|([^\)]*)))?\)/g;
		let lastIndex = 0;
		let m;
		while ((m = re.exec(text)) !== null){
			if (m.index > lastIndex) out.push({ text: text.slice(lastIndex, m.index) });
			const fn = m[1];
			const firstQuoted = (m[2] !== undefined && m[2] !== null) ? m[2] : (m[3] !== undefined && m[3] !== null) ? m[3] : null;
			const firstUnquoted = (m[4] !== undefined && m[4] !== null) ? String(m[4]).trim() : null;
			const secondQuoted = (m[5] !== undefined && m[5] !== null) ? m[5] : (m[6] !== undefined && m[6] !== null) ? m[6] : null;
			const secondUnquoted = (m[7] !== undefined && m[7] !== null) ? String(m[7]).trim() : null;
			
			const first = firstQuoted !== null ? firstQuoted : firstUnquoted;
			const second = secondQuoted !== null ? secondQuoted : secondUnquoted;
			
			const style = {};
			let displayText = '';

			if (fn === 'color'){
				const tryRgbFromString = (s)=>{
					const mm = String(s).trim().match(/^#?([0-9a-fA-F]{6})$/);
					if (mm) return '#' + mm[1];
					const mm2 = String(s).trim().match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
					if (mm2){
						return 'rgb(' + [mm2[1], mm2[2], mm2[3]].map(Number).join(',') + ')';
					}
					return null;
				};
				
				let col = tryRgbFromString(first);
				if (!col && first) col = first;
				if (col) style.color = col;
				
				if (second !== null && second !== undefined && second !== '') {
					displayText = second;
				} else if (first) {
					displayText = first;
				}
			} else if (fn === 'bold'){
				style.fontWeight = '700';
				displayText = second || first || '';
			} else if (fn === 'size'){
				let sz = Number(first);
				if (Number.isNaN(sz) && second) sz = Number(second);
				if (!Number.isNaN(sz)) style.fontSize = sz + 'px';
				displayText = second || first || '';
			}

			out.push({ text: displayText, style });
			lastIndex = re.lastIndex;
		}
		if (lastIndex < text.length) out.push({ text: text.slice(lastIndex) });
		return out;
	}

	ElementHandler.register('text', async function(el, env){
		const txt = el && el.text != null ? el.text : '';
		const tokens = parseInline(txt);
		if (env && typeof env.typeToTerminal === 'function'){
			await env.typeToTerminal(tokens);
			return;
		}
	});
	ElementHandler.register('text_typewritter', async function(el, env){
		const params = (el && el.params) || [];
		const min = Math.max(0, Number(params[0]) || 30);
		const max = Math.max(min, Number(params[1]) || 90);
		const txt = el && el.text != null ? el.text : '';
		const tokens = parseInline(txt);
		if (env && typeof env.typeToTerminalWithRange === 'function'){
			await env.typeToTerminalWithRange(tokens, min, max);
		} else if (env && typeof env.typeToTerminal === 'function'){
			await env.typeToTerminal(tokens);
		}
	});
})();
