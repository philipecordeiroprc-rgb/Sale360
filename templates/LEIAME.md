# Templates de Importação — Sale360

Formatos: **CSV com separador `;` (ponto e vírgula)** e encoding **UTF-8**.

> ⚠️ **Importante:** Use ponto-e-vírgula como separador pois os valores decimais usam vírgula (ex: `25,90`).

---

## 1. Produtos (`import_produtos.csv`)

| # | Campo | Obrigatório | Tipo | Descrição |
|---|-------|:-----------:|------|-----------|
| 1 | **Nome** | ✅ | Texto | Nome do produto |
| 2 | Descrição | ❌ | Texto | Descrição detalhada (IA pode gerar automaticamente) |
| 3 | SKU | ❌ | Texto | Código interno do produto |
| 4 | Código de Barras | ❌ | Número | Código EAN-13 ou similar (pode ser lido pela câmera) |
| 5 | Categoria | ❌ | Texto | Nome exato de uma categoria já cadastrada |
| 6 | **Preço de Venda** | ✅ | Decimal | Preço final para o cliente (ex: `25,90`) |
| 7 | Custo Unitário | ❌ | Decimal | Preço pago ao fornecedor por unidade |
| 8 | Custo Operacional | ❌ | Decimal | Custo fixo adicional (embalagem, frete, etc.) |
| 9 | Taxa (%) | ❌ | Decimal | Percentual médio da taxa de cartão (ex: `2,5`) |
| 10 | Estoque Inicial | ❌ | Decimal | Quantidade inicial em estoque |
| 11 | Estoque Mínimo | ❌ | Decimal | Quantidade que dispara alerta de estoque baixo |
| 12 | Unidade | ❌ | Texto | `UN` (unidade), `KG`, `G`, `L`, `ML`, `M`, `PC` (peça), `CX` (caixa), `PAR`, `FD` (fardo), `PCT` (pacote), `M2` — padrão: `UN` |
| 13 | Ativo | ❌ | Texto | `SIM` ou `NÃO` — padrão: `SIM` |
| 14 | Fracionado | ❌ | Texto | `SIM` se vende por grama/kg/metro (ex: frios, granel) — padrão: `NÃO` |

### Cálculo da Margem

A margem bruta é calculada automaticamente:

```
Margem Bruta (%) = (Preço de Venda - Custo Unitário - Custo Operacional - (Preço de Venda × Taxa / 100)) / Preço de Venda × 100
```

**Exemplo com Arroz:**
- Preço de Venda: R$ 25,90
- Custo Unitário: R$ 18,50
- Custo Operacional: R$ 1,20
- Taxa: 2,5% = R$ 0,65
- **Margem Bruta = (25,90 - 18,50 - 1,20 - 0,65) / 25,90 × 100 = 21,4%**

---

## 2. Categorias (`import_categorias.csv`)

| # | Campo | Obrigatório | Tipo | Descrição |
|---|-------|:-----------:|------|-----------|
| 1 | **Nome** | ✅ | Texto | Nome da categoria (único por loja) |
| 2 | Cor (hex) | ❌ | Cor | Cor em hexadecimal para a UI (ex: `#22c55e`) |
| 3 | Ordem | ❌ | Número | Ordem de exibição (0 = primeiro) |
| 4 | Template de Variação | ❌ | Texto | Nome do template: `Peso (Granel)`, `Volume (Líquidos)`, `Vestuário Adulto`, etc. |

### Templates de Variação disponíveis

Os templates de variação precisam ser criados manualmente no painel admin antes da importação. Exemplos:
- **Peso (Granel)** — opções: 100g, 250g, 500g, 1kg
- **Volume (Líquidos)** — opções: 200ml, 350ml, 500ml, 1L, 2L
- **Vestuário Adulto** — dimensões: Tamanho (PP,P,M,G,GG) + Cor

---

## 3. Fornecedores (`import_fornecedores.csv`)

| # | Campo | Obrigatório | Tipo | Descrição |
|---|-------|:-----------:|------|-----------|
| 1 | **Nome** | ✅ | Texto | Nome do fornecedor |
| 2 | CNPJ | ❌ | Texto | CNPJ (formato: `12.345.678/0001-90`) — único no sistema |
| 3 | IE | ❌ | Texto | Inscrição Estadual |
| 4 | Email | ❌ | Email | Email de contato |
| 5 | Telefone | ❌ | Texto | Telefone fixo |
| 6 | WhatsApp | ❌ | Texto | Número WhatsApp |
| 7 | Contato | ❌ | Texto | Nome da pessoa de contato |
| 8 | Endereço | ❌ | Texto | Rua/Avenida |
| 9 | Número | ❌ | Texto | Número do endereço |
| 10 | Complemento | ❌ | Texto | Complemento (sala, galpão, etc.) |
| 11 | Bairro | ❌ | Texto | Bairro |
| 12 | Cidade | ❌ | Texto | Cidade |
| 13 | Estado | ❌ | Texto | UF (2 letras, ex: `SP`) |
| 14 | CEP | ❌ | Texto | CEP (formato: `01001-000`) |
| 15 | Observações | ❌ | Texto | Notas internas sobre o fornecedor |
| 16 | Ativo | ❌ | Texto | `SIM` ou `NÃO` — padrão: `SIM` |

---

## Instruções de Uso

1. Baixe o template desejado (CSV)
2. Abra no **Excel, Google Sheets ou LibreOffice Calc**
3. **Importante:** Ao salvar, escolha o formato **CSV (separador ponto e vírgula)** e encoding **UTF-8**
4. Preencha os dados — **não remova nem altere a linha de cabeçalho**
5. Campos marcados com `*` são obrigatórios
6. Faça upload do arquivo na tela de Produtos/Categorias/Fornecedores
7. O sistema fará uma **pré-visualização** antes de confirmar a importação
