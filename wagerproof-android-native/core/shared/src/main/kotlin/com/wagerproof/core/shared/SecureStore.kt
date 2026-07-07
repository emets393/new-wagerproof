package com.wagerproof.core.shared

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext

/**
 * Encrypted string storage — port of iOS `WagerproofSharedKit/KeychainStore.swift`
 * (an actor over Security-framework generic-password items).
 *
 * Android analog per docs/inventory/04_design.md §2: a Keystore-backed AES-GCM
 * key encrypts values that live in a dedicated `DataStore<Preferences>` file.
 * The AES key never leaves the hardware keystore, so the on-disk prefs hold
 * only ciphertext. Same API surface as iOS: suspend setString/getString/remove.
 *
 * Values are stored as base64(iv ‖ ciphertext); GCM authenticates, so
 * tampered entries fail decryption and read as null (iOS returns nil for
 * missing/invalid items too).
 */
class SecureStore(context: Context) {

    private val appContext = context.applicationContext
    private val dataStore: DataStore<Preferences> get() = appContext.secureStoreDataStore

    suspend fun setString(value: String, key: String) = withContext(Dispatchers.IO) {
        val encrypted = encrypt(value.toByteArray(Charsets.UTF_8))
        dataStore.edit { it[stringPreferencesKey(key)] = encrypted }
    }

    suspend fun getString(key: String): String? = withContext(Dispatchers.IO) {
        val stored = dataStore.data.first()[stringPreferencesKey(key)] ?: return@withContext null
        runCatching { String(decrypt(stored), Charsets.UTF_8) }.getOrNull()
    }

    suspend fun remove(key: String) {
        dataStore.edit { it.remove(stringPreferencesKey(key)) }
    }

    // MARK: - Keystore AES-GCM

    private fun encrypt(plain: ByteArray): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        val payload = cipher.iv + cipher.doFinal(plain)
        return Base64.encodeToString(payload, Base64.NO_WRAP)
    }

    private fun decrypt(encoded: String): ByteArray {
        val payload = Base64.decode(encoded, Base64.NO_WRAP)
        val iv = payload.copyOfRange(0, IV_LENGTH)
        val cipherText = payload.copyOfRange(IV_LENGTH, payload.size)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(TAG_BITS, iv))
        return cipher.doFinal(cipherText)
    }

    private fun secretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return generator.generateKey()
    }

    private companion object {
        // Mirrors iOS's Keychain service id `com.wagerproof.mobile`.
        const val KEY_ALIAS = "com.wagerproof.mobile"
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_LENGTH = 12 // GCM standard nonce
        const val TAG_BITS = 128
    }
}

private val Context.secureStoreDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "secure_store",
)
