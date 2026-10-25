from sqlalchemy import func


def fold(column):
    """Aramada büyük/küçük harf ve noktalı/noktasız i ayrımı yapılmaz.
    lower('İ') Postgres'te noktalı 'i̇' verir ve 'i' ile eşleşmez; İ ve ı önce 'i' yapılır."""
    return func.lower(func.replace(func.replace(column, "İ", "i"), "ı", "i"))


def fold_text(text: str) -> str:
    return text.strip().replace("İ", "i").replace("ı", "i").lower()
