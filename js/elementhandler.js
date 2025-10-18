(function(){
	window.ElementHandler = {
		handlers: {},
		register(name, fn){
			this.handlers[name] = fn;
		},
		parseLine(line){
			const trimmed = String(line || '').trim();
			const cleaned = trimmed;

			const mMenuBraces = cleaned.match(/^<menu>\s*\(\s*(['"])(.*?)\1\s*,\s*\{\s*([\s\S]*?)\s*\}\s*,\s*(true|false)\s*\)\s*$/s);
			if (mMenuBraces){
				const title = mMenuBraces[2];
				const content = mMenuBraces[3];
				const flag = mMenuBraces[4];
				return { name: 'menu', params: [ title, flag ], text: content, raw: line };
			}

			const mMenu = cleaned.match(/^<menu>\s*\(([^)]*)\)\s*(['"])([\s\S]*)\2\s*$/s)
				|| cleaned.match(/^<menu>\s*\(([^)]*)\)\s*(['"])([\s\S]*)\2\s*<\/menu>\s*$/s);
			if (mMenu){
				const rawParams = mMenu[1].split(',').map(s=>s.trim()).filter(Boolean);
				const text = mMenu[3];
				return { name: 'menu', params: rawParams, text, raw: line };
			}

			let m = cleaned.match(/^<([a-zA-Z0-9_]+)>\s*\(([^)]*)\)\s*(['"])([\s\S]*)\3\s*$/)
				|| cleaned.match(/^<([a-zA-Z0-9_]+)>\s*\(([^)]*)\)\s*(['"])([\s\S]*)\3\s*<\/\1>\s*$/);
			if (m){
				const name = m[1];
				const rawParams = m[2].split(',').map(s=>s.trim()).filter(Boolean);
				const text = m[4];
				return { name, params: rawParams, text, raw: line };
			}
			m = cleaned.match(/^<([a-zA-Z0-9_]+)>\s*([^'"]+?)\s*(['"])([\s\S]*)\3\s*$/)
				|| cleaned.match(/^<([a-zA-Z0-9_]+)>\s*([^'"]+?)\s*(['"])([\s\S]*)\3\s*<\/\1>\s*$/);
			if (m){
				const name = m[1];
				const raw = m[2].trim();
				const params = raw.length ? raw.split(',').map(s=>s.trim()).filter(Boolean) : [];
				const text = m[4];
				return { name, params, text, raw: line };
			}
			const mNoParams = cleaned.match(/^<([a-zA-Z0-9_]+)>\s*(['"])([\s\S]*)\2\s*$/)
				|| cleaned.match(/^<([a-zA-Z0-9_]+)>\s*(['"])([\s\S]*)\2\s*<\/\1>\s*$/);
			if (mNoParams){
				return { name: mNoParams[1], params: [], text: mNoParams[3], raw: line };
			}
			return null;
		},
		async renderLine(line, env){
			const el = this.parseLine(line);
			if (!el){
				if (env && typeof env.typeToTerminal === 'function'){
					await env.typeToTerminal(line);
				}
				return;
			}
			const handler = this.handlers[el.name];
			if (typeof handler === 'function'){
				await handler(el, env || {});
				return;
			}
			if (env && typeof env.typeToTerminal === 'function'){
				await env.typeToTerminal(line);
			}
		}
	};
})();
