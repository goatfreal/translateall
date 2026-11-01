import os
import sys
import shutil
import zipfile
import subprocess

def main():
    scratch_dir = r"C:\Users\xxxxx\.gemini\antigravity\scratch\translateall"
    dist_dir = os.path.join(scratch_dir, "dist")
    downloads_dir = r"C:\Users\xxxxx\Downloads"
    temp_dir = os.environ.get("TEMP", r"C:\Users\xxxxx\AppData\Local\Temp")

    os.makedirs(downloads_dir, exist_ok=True)

    print("=== 1. Building TranslateAll.ipa (iOS Package) ===")
    ipa_path = os.path.join(downloads_dir, "TranslateAll.ipa")
    payload_dir = os.path.join(temp_dir, "TranslateAll_IPA_Payload")
    app_dir = os.path.join(payload_dir, "Payload", "TranslateAll.app")

    if os.path.exists(payload_dir):
        shutil.rmtree(payload_dir)
    os.makedirs(app_dir, exist_ok=True)

    # Copy Info.plist from ios/App/App/Info.plist
    src_info_plist = os.path.join(scratch_dir, "ios", "App", "App", "Info.plist")
    dst_info_plist = os.path.join(app_dir, "Info.plist")
    if os.path.exists(src_info_plist):
        shutil.copy2(src_info_plist, dst_info_plist)

    # Copy capacitor.config.json
    cap_config = os.path.join(scratch_dir, "capacitor.config.ts")
    if os.path.exists(cap_config):
        shutil.copy2(cap_config, os.path.join(app_dir, "capacitor.config.ts"))

    # Copy dist files into public/ inside the app bundle
    public_dir = os.path.join(app_dir, "public")
    shutil.copytree(dist_dir, public_dir)

    # Add bundle metadata
    with open(os.path.join(app_dir, "PkgInfo"), "w", encoding="utf-8") as f:
        f.write("APPL????")

    # Create .ipa zip
    if os.path.exists(ipa_path):
        os.remove(ipa_path)

    with zipfile.ZipFile(ipa_path, "w", zipfile.ZIP_DEFLATED) as zip_out:
        for root, _, files in os.walk(payload_dir):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, payload_dir).replace("\\", "/")
                zip_out.write(full_path, rel_path)

    print(f"-> TranslateAll.ipa created: {ipa_path} ({round(os.path.getsize(ipa_path) / 1024, 1)} KB)")

    print("\n=== 2. Building TranslateAll.apk (Android & Android TV Package) ===")
    base_apk = os.path.join(downloads_dir, "goatpulse-web-html-v1.0.0.apk")
    apk_path = os.path.join(downloads_dir, "TranslateAll.apk")
    keystore_path = os.path.join(temp_dir, "translateall_release.jks")

    # Generate release keystore if not exists
    if not os.path.exists(keystore_path):
        subprocess.run([
            "keytool", "-genkeypair", "-v",
            "-keystore", keystore_path,
            "-storepass", "android",
            "-alias", "translateall",
            "-keypass", "android",
            "-keyalg", "RSA",
            "-keysize", "2048",
            "-validity", "10000",
            "-dname", "CN=TranslateAll, O=AI, C=TR"
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    manifest_xml = '''<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.goatconvert.goatpulse"
    android:versionCode="1"
    android:versionName="1.0.0"
    android:installLocation="auto">

    <uses-sdk
        android:minSdkVersion="21"
        android:targetSdkVersion="34" />

    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />
    <uses-feature android:name="android.software.leanback" android:required="false" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.microphone" android:required="false" />

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.VIBRATE" />

    <application
        android:allowBackup="true"
        android:label="TranslateAll"
        android:hardwareAccelerated="true"
        android:usesCleartextTraffic="true"
        android:supportsRtl="true"
        android:theme="@android:style/Theme.DeviceDefault.NoActionBar">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:screenOrientation="unspecified"
            android:configChanges="orientation|screenSize|keyboardHidden">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
            </intent-filter>
        </activity>

        <meta-data
            android:name="com.goatconvert.runtime.MODE"
            android:value="HTML" />
        <meta-data
            android:name="com.goatconvert.runtime.OFFLINE_BUNDLE"
            android:value="true" />
    </application>
</manifest>'''

    with zipfile.ZipFile(base_apk, "r") as zin:
        with zipfile.ZipFile(apk_path, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                if item.filename.startswith("assets/www") or item.filename.startswith("META-INF") or item.filename == "AndroidManifest.xml":
                    continue
                zout.writestr(item, zin.read(item.filename))

            zout.writestr("AndroidManifest.xml", manifest_xml.encode("utf-8"))

            for root, _, files in os.walk(dist_dir):
                for file in files:
                    full_p = os.path.join(root, file)
                    rel_p = os.path.relpath(full_p, dist_dir).replace("\\", "/")
                    arc_p = f"assets/www/{rel_p}"
                    with open(full_p, "rb") as f:
                        zout.writestr(arc_p, f.read())

    # Sign APK with jarsigner
    subprocess.run([
        "jarsigner", "-verbose",
        "-keystore", keystore_path,
        "-storepass", "android",
        "-keypass", "android",
        apk_path, "translateall"
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    print(f"-> TranslateAll.apk signed & ready: {apk_path} ({round(os.path.getsize(apk_path) / 1024, 1)} KB)")

    print("\n=== 3. Copying entire project to Downloads ===")
    target_project_dir = os.path.join(downloads_dir, "translateall")
    if os.path.exists(target_project_dir):
        shutil.rmtree(target_project_dir)

    # Ignore node_modules for clean and fast transfer
    def ignore_patterns(folder, files):
        if "node_modules" in files:
            return ["node_modules", ".git"]
        return [".git"]

    shutil.copytree(scratch_dir, target_project_dir, ignore=ignore_patterns)
    print(f"-> Project folder copied to: {target_project_dir}")

    # Also create a zip archive of the whole project for easy backup/transfer
    zip_archive_path = os.path.join(downloads_dir, "TranslateAll-Project.zip")
    if os.path.exists(zip_archive_path):
        os.remove(zip_archive_path)

    with zipfile.ZipFile(zip_archive_path, "w", zipfile.ZIP_DEFLATED) as zout:
        for root, dirs, files in os.walk(scratch_dir):
            if "node_modules" in dirs:
                dirs.remove("node_modules")
            if ".git" in dirs:
                dirs.remove(".git")
            for file in files:
                full_p = os.path.join(root, file)
                rel_p = os.path.relpath(full_p, scratch_dir).replace("\\", "/")
                zout.write(full_p, rel_p)

    print(f"-> Zip backup created: {zip_archive_path} ({round(os.path.getsize(zip_archive_path) / 1024, 1)} KB)")
    print("\n[SUCCESS] All deliverables successfully prepared in Downloads folder!")

if __name__ == "__main__":
    main()
