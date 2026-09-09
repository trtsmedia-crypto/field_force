# TensorFlow Lite uses reflection for its interpreter factory; R8's
# aggressive shrinking removes classes it can't see are actually used.
-keep class org.tensorflow.lite.** { *; }
-dontwarn org.tensorflow.lite.**

# ML Kit face detection has a similar reflection-based pattern.
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# Geolocator and camera plugins occasionally trip the same issue.
-keep class com.baseflow.** { *; }
-dontwarn com.baseflow.**
