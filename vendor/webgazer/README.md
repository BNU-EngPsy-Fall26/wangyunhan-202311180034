# Vendored WebGazer and local Face Mesh assets

WebGazer official source: https://github.com/brownhci/WebGazer
Official documentation: https://webgazer.cs.brown.edu/

Unmodified www/webgazer.js from commit b12701dd7b6d7b00d4b8dbebf87fdec840c24999.
Corresponding source: https://github.com/brownhci/WebGazer/tree/b12701dd7b6d7b00d4b8dbebf87fdec840c24999
GPL-3.0-or-later: see LICENSE.md and gplv3.md. Preserve notices when distributing.

The bundled default tracker uses MediaPipe runtime and solutionPath ./mediapipe/face_mesh (relative to the document). The complete official @mediapipe/face_mesh 0.4.1633559619 package is extracted at ../../mediapipe/face_mesh, with Apache-2.0 LICENSE. Its .tgz is retained here with npm integrity metadata. The SIMD .data is an intentionally empty upstream file. Unused TFJS model URL constants in the WebGazer bundle do not change the selected tracker.

manifest.json records commit, source URLs, npm integrity check, and SHA256 hashes. No CDN script is inserted by gaze.js. Serve the whole project from the same origin; retain .wasm/.data/.binarypb files. Configure .wasm as application/wasm on hosts that need MIME setup.

The optional application integration is ../../gaze.js; the third-party bundle is not patched. It disables cross-session saved training and mouse/click auto-training. Camera access is requested only after separate consent and an explicit enable click. No recordings or image frames are included in exports or submissions.
