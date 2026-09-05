-- AlterTable: better-auth >=1.2 mengirim issuer saat create account (credential).
-- Tanpa kolom ini semua signup user baru gagal (Unknown argument `issuer`).
ALTER TABLE "account" ADD COLUMN "issuer" TEXT;
