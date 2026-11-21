const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

const paths = [
	['barang-diterima', 'BARANG_DITERIMA'],
	['sedang-dipacking', 'SEDANG_DIPACKING'],
	['dalam-proses-retur', 'DALAM_PROSES_RETUR'],
	['terpasang-digunakan', 'TERPASANG_DIGUNAKAN'],
];
(async () => {
	for (const [path, expected] of paths) {
		let checked;
		const module = { exports: {} };
		const modules = {
			'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
			'@/features/member/MemberScannerPage': { MemberScannerPage: 'scanner' },
			'@/lib/session': {
				getAppSession: async () => ({ allowed_status: [expected] }),
				requireSelectedMemberProject: async () => ({ task_id: 'project' }),
				requirePpicStatusAccess: async (status) => { checked = status; },
			},
		};
		const source = ts.transpileModule(readFileSync(`src/app/(member)/${path}/page.tsx`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
		runInNewContext(source, { module, exports: module.exports, require: id => { if (!modules[id]) throw Error(`Unexpected dependency ${id}`); return modules[id]; } });
		const result = await module.exports.default();
		assert.equal(checked, expected);
		assert.deepEqual(Array.from(result.props.allowedStatuses), [expected]);
	}
	console.log('Scanner pages use the signed session and check the requested status');
})().catch(error => { console.error(error); process.exitCode = 1; });
