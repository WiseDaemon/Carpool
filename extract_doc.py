import docx

doc = docx.Document('Reliance_Carpool_Product_Document.docx')
with open('doc_content.txt', 'w', encoding='utf-8') as f:
    for i, p in enumerate(doc.paragraphs):
        f.write(f"[{i}] {p.text}\n")
