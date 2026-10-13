// Root build.gradle.kts
buildscript {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id("com.android.application") version "8.2.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}

// Build Vite/React web assets using npm
val buildWebAssets by tasks.registering(Exec) {
    description = "Transpiles Vite/React web application assets"
    group = "build"
    workingDir = rootDir.parentFile
    commandLine(if (System.getProperty("os.name").lowercase().contains("windows")) listOf("cmd", "/c", "npm", "run", "build") else listOf("npm", "run", "build"))
}

// Copy transpiled Vite dist/ output into android/app/src/main/assets/web
val copyWebAssets by tasks.registering(Copy) {
    description = "Copies transpiled web assets into the Android app assets directory"
    group = "build"
    dependsOn(buildWebAssets)
    from(File(rootDir.parentFile, "dist"))
    into(File(project(":app").projectDir, "src/main/assets/web"))
}

