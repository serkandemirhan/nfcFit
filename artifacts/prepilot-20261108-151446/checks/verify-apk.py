from pathlib import Path
import json,zipfile,hashlib,shutil,subprocess
root=Path('/Users/user/NFCFit/mobile/nfc-task-tracker')
source_map=json.loads((root/'android/app/build/intermediates/sourcemaps/react/release/index.android.bundle.packager.map').read_text())
checked=[];mismatch=[]
for name,content in zip(source_map['sources'],source_map['sourcesContent']):
 rel=name.replace('\\','/').removeprefix('../../')
 # Metro emits project-relative and absolute source identifiers.
 path=Path(name) if name.startswith(str(root)+'/') else root/rel.lstrip('/')
 if not path.is_file() or not path.resolve().is_relative_to(root):continue
 rel=path.resolve().relative_to(root)
 if str(rel).startswith(('app/','components/','lib/','hooks/','providers/','constants/')) and 'node_modules' not in str(rel):
  if path.read_text()!=content:mismatch.append(str(rel))
  else:checked.append(str(rel))
assert not mismatch, mismatch
assert any('react-native-svg' in name for name in source_map['sources'])
assert json.loads((root/'package.json').read_text())['main']=='expo-router/entry'
assert not (root/'.nfcfit-design-review').exists()
assert not (root/'metro.config.js').exists()
assert not any('.nfcfit-design-review' in s for s in source_map['sources'])
assert not any('NFCFIT_DESIGN_REVIEW' in (s or '') for s in source_map['sourcesContent'])
assert len(checked)>35, ('Too few source entries',len(checked))
for required in ['lib/console-transport.ts','lib/offline-refresh.ts','lib/plan-draft.ts','lib/tag-link.ts','app/goals.tsx','lib/starter-programs.ts','lib/member-experience.ts','lib/session-presentation.ts','lib/keyboard-frame.ts','components/keyboard-frame.tsx','hooks/use-session-clock.ts','lib/coaching-query-keys.ts','app/coaching-sync.tsx','components/plan-coach-context.tsx','app/(drawer)/settings.tsx','components/app-bottom-nav.tsx','app/workout/[id].tsx','components/workout-controls.tsx','components/member-week.tsx','components/activity-trends.tsx','components/workout-nfc-context.tsx','lib/workout-experience.ts','components/fitness-ui.tsx','components/fitness-art.tsx','components/athlete-dashboard.tsx','lib/athlete-presentation.ts','app/plan-setup.tsx','app/(drawer)/personal-goals.tsx','app/_layout.tsx','app/progress.tsx','components/account-timezone.tsx','components/exercise-media.tsx','lib/coaching-performance.ts','lib/i18n/locales/coaching-en.json','lib/console-access.ts','components/staff-area.tsx','app/(drawer)/exercise-library.tsx']:
 assert required in checked, ('Missing bundled source',required)
metadata=json.loads((root/'android/app/build/outputs/apk/release/output-metadata.json').read_text())
assert metadata['applicationId']=='com.serkandemirhan.nfcfit'
assert metadata['elements'][0]['versionName']=='1.0.21'
assert metadata['elements'][0]['versionCode']==22
apk=root/'android/app/build/outputs/apk/release/app-release.apk'
with zipfile.ZipFile(apk) as archive:
 assert archive.read('assets/index.android.bundle')==(root/'android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle').read_bytes()
 for abi in ['arm64-v8a','armeabi-v7a','x86','x86_64']:assert f'lib/{abi}/libexpo-sqlite.so' in archive.namelist()
subprocess.run(['/Users/user/Library/Android/sdk/build-tools/36.0.0/apksigner','verify','--print-certs',str(apk)],check=True,stdout=open('/tmp/nfcfit-prepilot-apk-certificate.log','w'))
assert 'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c' in Path('/tmp/nfcfit-prepilot-apk-certificate.log').read_text()
copy=apk.with_name('NFCFit-1.0.21.apk');shutil.copy2(apk,copy)
result={'apk':str(copy),'bytes':copy.stat().st_size,'sha256':hashlib.sha256(copy.read_bytes()).hexdigest(),'source_files_verified':len(checked),'version':'1.0.21','versionCode':22}
Path('/tmp/nfcfit-prepilot-release.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
