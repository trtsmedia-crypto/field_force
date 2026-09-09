import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:camera/camera.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;
import 'package:tflite_flutter/tflite_flutter.dart';

/// Must match EMBEDDING_LENGTH in the backend's src/utils/face.ts.
const kEmbeddingLength = 192;

/// Input size MobileFaceNet expects.
const _inputSize = 112;

class FaceResult {
  const FaceResult({required this.embedding, required this.jpegBase64});

  final List<double> embedding;
  final String jpegBase64;
}

class FaceFailure implements Exception {
  FaceFailure(this.message, {this.canRetry = true});

  final String message;
  final bool canRetry;

  @override
  String toString() => message;
}

/// Turns a camera photo into a 192-number face embedding.
///
/// Two steps: ML Kit finds the face and gives its box, then MobileFaceNet
/// turns the cropped face into numbers. The numbers go to the server; the
/// server decides whether they match.
class FaceService {
  FaceService._();
  static final FaceService instance = FaceService._();

  Interpreter? _interpreter;
  FaceDetector? _detector;

  bool get isReady => _interpreter != null;

  Future<void> init() async {
    if (_interpreter != null) return;
    try {
      _interpreter = await Interpreter.fromAsset(
        'assets/models/mobilefacenet.tflite',
      );
    } catch (_) {
      throw FaceFailure(
        'Face recognition is not set up on this build. '
        'The model file is missing from assets/models/.',
        canRetry: false,
      );
    }
    _detector = FaceDetector(
      options: FaceDetectorOptions(
        performanceMode: FaceDetectorMode.accurate,
        enableLandmarks: true,
        enableClassification: true,
        minFaceSize: 0.25,
      ),
    );
  }

  Future<void> dispose() async {
    await _detector?.close();
    _interpreter?.close();
    _detector = null;
    _interpreter = null;
  }

  /// Runs detection and embedding on a picture taken by the camera.
  ///
  /// Throws [FaceFailure] with a message meant for the user — no faces, more
  /// than one face, eyes closed, or a face too small to be reliable.
  Future<FaceResult> process(XFile picture) async {
    await init();

    final faces = await _detector!.processImage(
      InputImage.fromFilePath(picture.path),
    );

    if (faces.isEmpty) {
      throw FaceFailure(
        'No face detected. Hold the phone at arm\'s length in good light.',
      );
    }
    if (faces.length > 1) {
      throw FaceFailure(
        'More than one face in the frame. Make sure only you are in the photo.',
      );
    }

    final face = faces.first;

    // A closed-eye frame is usually a blink at the wrong moment; asking again
    // is cheaper than storing a bad reference.
    final leftOpen = face.leftEyeOpenProbability;
    final rightOpen = face.rightEyeOpenProbability;
    if (leftOpen != null && rightOpen != null &&
        leftOpen < 0.3 && rightOpen < 0.3) {
      throw FaceFailure('Your eyes were closed. Look at the camera and try again.');
    }

    final bytes = await File(picture.path).readAsBytes();
    final decoded = img.decodeImage(bytes);
    if (decoded == null) {
      throw FaceFailure('That photo could not be read. Try again.');
    }

    final box = face.boundingBox;
    if (box.width < 80 || box.height < 80) {
      throw FaceFailure('Move closer to the camera and try again.');
    }

    // Pad the crop a little; MobileFaceNet does better with some margin.
    final pad = box.width * 0.15;
    final left = (box.left - pad).clamp(0, decoded.width - 1).toInt();
    final top = (box.top - pad).clamp(0, decoded.height - 1).toInt();
    final right = (box.right + pad).clamp(0, decoded.width).toInt();
    final bottom = (box.bottom + pad).clamp(0, decoded.height).toInt();

    final cropped = img.copyCrop(
      decoded,
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    );
    final resized = img.copyResize(
      cropped,
      width: _inputSize,
      height: _inputSize,
      interpolation: img.Interpolation.cubic,
    );

    final embedding = _embed(resized);

    // The stored selfie is the framed face, not the full photo — smaller to
    // upload and it is what a reviewer actually needs to see.
    final jpeg = img.encodeJpg(
      img.copyResize(cropped, width: 320),
      quality: 82,
    );

    return FaceResult(
      embedding: embedding,
      jpegBase64: base64Encode(jpeg),
    );
  }

  List<double> _embed(img.Image face) {
    // MobileFaceNet expects values scaled to roughly -1..1.
    final input = List.generate(
      1,
      (_) => List.generate(
        _inputSize,
        (y) => List.generate(_inputSize, (x) {
          final pixel = face.getPixel(x, y);
          return [
            (pixel.r - 127.5) / 127.5,
            (pixel.g - 127.5) / 127.5,
            (pixel.b - 127.5) / 127.5,
          ];
        }),
      ),
    );

    final output = List.generate(1, (_) => List.filled(kEmbeddingLength, 0.0));
    _interpreter!.run(input, output);

    final raw = output.first;

    // Normalising here means the server's cosine similarity is comparing
    // like with like regardless of lighting intensity.
    var sum = 0.0;
    for (final v in raw) {
      sum += v * v;
    }
    final norm = math.sqrt(sum);
    if (norm == 0) {
      throw FaceFailure('The face scan came out blank. Try again.');
    }
    return raw.map((v) => v / norm).toList();
  }
}
