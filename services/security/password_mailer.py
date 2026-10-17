import asyncio
import smtplib
import ssl
from email.message import EmailMessage
from packages.config.settings import settings


async def send_password_code(email: str, code: str):
    if not settings.SMTP_HOST:
        raise RuntimeError("Parola sıfırlama e-posta servisi yapılandırılmamış")
    message = EmailMessage()
    message["From"] = settings.SMTP_FROM
    message["To"] = email
    message["Subject"] = "CALPEO — Şifre sıfırlama kodunuz"
    message.set_content(f"Şifre sıfırlama kodunuz: {code}\n\nKod 15 dakika geçerlidir. Bu işlemi siz başlatmadıysanız kodu paylaşmayın.")

    def deliver():
        client_type = smtplib.SMTP_SSL if settings.SMTP_PORT == 465 else smtplib.SMTP
        with client_type(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
            if settings.SMTP_PORT != 465:
                smtp.starttls(context=ssl.create_default_context())
            if settings.SMTP_USER:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD or "")
            smtp.send_message(message)

    await asyncio.to_thread(deliver)
