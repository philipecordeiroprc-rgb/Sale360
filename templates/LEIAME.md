# Templates de Importação — Sale360

Formatos: **CSV com separador `;` (ponto e vírgula)** e encoding **UTF-8**.

> ⚠️ **Importante:** Use ponto-e-vírgula como separador pois os valores decimais usam vírgula (ex: `25,90`).

---

## 1. Produtos Simples (`import_produtos.csv`)

> Para produtos COM variações (roupas, calçados, bebidas com múltiplos tamanhos/sabores), use o template `import_produtos_variacoes.csv` (seção 4).

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

Os templates de variação podem ser importados via `import_templates_variacao.csv` (veja seção 3) ou criados manualmente no painel admin.

---

## 3. Templates de Variação (`import_templates_variacao.csv`)

Define os templates que agrupam dimensões de variação (ex: Tamanho + Cor). Obrigatório antes de importar produtos com variações.

| # | Campo | Obrigatório | Tipo | Descrição |
|---|-------|:-----------:|------|-----------|
| 1 | **Nome do Template** | ✅ | Texto | Nome único do template (ex: `Vestuário Infantil`) |
| 2 | **Dim 1 - Tipo** | ✅ | Enum | Tipo da 1ª dimensão (veja tabela abaixo) |
| 3 | **Dim 1 - Rótulo** | ✅ | Texto | Nome exibido na UI (ex: `Tamanho`, `Cor`) |
| 4 | **Dim 1 - Opções** | ✅ | Lista | Valores separados por vírgula (ex: `2,4,6,8,10`) |
| 5 | Dim 2 - Tipo | ❌ | Enum | Tipo da 2ª dimensão |
| 6 | Dim 2 - Rótulo | ❌ | Texto | Nome exibido na UI |
| 7 | Dim 2 - Opções | ❌ | Lista | Valores separados por vírgula |

### Tipos de Dimensão (`Dim - Tipo`)

| Código | Descrição | Exemplo de Opções |
|--------|-----------|-------------------|
| `TAMANHO_LETRA` | Tamanho por letra | PP, P, M, G, GG, XG, XGG |
| `TAMANHO_NUMERO` | Tamanho por número | 2, 4, 6, 8, 10, 12... ou 34, 35, 36... 44 |
| `COR` | Cor do produto | Vermelho, Azul, Preto, Branco |
| `VOLUME` | Volume líquido | 200ml, 350ml, 500ml, 1L, 2L |
| `PESO` | Peso | 100g, 250g, 500g, 1kg, 5kg |
| `PERSONALIZADO` | Dimensão livre | Qualquer valor definido pelo lojista |

---

## 4. Produtos com Variações (`import_produtos_variacoes.csv`)

Para produtos que possuem variações (roupas, calçados, bebidas). **Cada linha representa UMA variação** do produto. O produto principal é criado automaticamente na primeira linha e as demais linhas adicionam variações a ele.

| # | Campo | Obrigatório | Tipo | Descrição |
|---|-------|:-----------:|------|-----------|
| 1 | **Nome do Produto** | ✅ | Texto | Nome base do produto (igual em todas as linhas da mesma variação) |
| 2 | Categoria | ❌ | Texto | Nome da categoria (deve ter um template de variação vinculado) |
| 3 | **Preço Base** | ✅ | Decimal | Preço de venda base (ex: `49,90`) |
| 4 | **Dim 1** | ✅ | Texto | Valor da 1ª dimensão (ex: `2`, `M`, `Vermelha`). **O nome da coluna deve ser o Rótulo da Dim 1** |
| 5 | Dim 2 | ❌ | Texto | Valor da 2ª dimensão. **O nome da coluna deve ser o Rótulo da Dim 2** |
| 6 | **Qtd** | ✅ | Decimal | Quantidade em estoque desta variação |
| 7 | Preço Extra | ❌ | Decimal | Acréscimo sobre o preço base (ex: G custa `5,00` a mais) — padrão: `0,00` |
| 8 | SKU | ❌ | Texto | Código interno desta variação |
| 9 | Código de Barras | ❌ | Número | Código EAN-13 específico da variação |
| 10 | Estoque Mínimo | ❌ | Decimal | Quantidade que dispara alerta de estoque baixo |

> ⚠️ **Importante:** Os nomes das colunas 4 e 5 devem corresponder exatamente aos **Rótulos** definidos no template de variação.
> 
> Exemplo: Se o template "Vestuário Infantil" tem `Dim 1 - Rótulo = Tamanho` e `Dim 2 - Rótulo = Cor`, as colunas devem se chamar `Tamanho` e `Cor`.

### Exemplo prático — Camiseta Infantil

**Template:** Vestuário Infantil (Tamanho: 2,4,6,8 + Cor: Rosa, Azul Claro)

| Nome do Produto | Categoria | Preço Base | Tamanho | Cor | Qtd |
|-----------------|-----------|------------|---------|-----|-----|
| Camiseta Turma da Mônica | Roupas | 49,90 | 2 | Rosa | 5 |
| Camiseta Turma da Mônica | Roupas | 49,90 | 2 | Azul Claro | 8 |
| Camiseta Turma da Mônica | Roupas | 49,90 | 4 | Rosa | 6 |
| ... | ... | ... | ... | ... | ... |

O sistema criará **1 produto** "Camiseta Turma da Mônica" com **8 variações** (todas as combinações fornecidas).

---

## 5. Fornecedores (`import_fornecedores.csv`) (`import_fornecedores.csv`)

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
