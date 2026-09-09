Put mobilefacenet.tflite in this folder.

The model is not bundled here because of its licence. Download a MobileFaceNet
TFLite model with a 192-dimension output — the file is about 5 MB. Search
GitHub for "mobilefacenet.tflite"; the MobileFaceNet_TF and
Face-Recognition-Flutter projects both carry a working copy.

The file must be named exactly:  mobilefacenet.tflite

Without it the app still runs, but face registration and attendance face checks
will show a clear error instead of working. Everything else is unaffected.

If you use a model with a different output size, change EMBEDDING_LENGTH in
lib/features/face/face_service.dart AND in the backend's src/utils/face.ts —
they must agree, and everyone must re-enrol.
