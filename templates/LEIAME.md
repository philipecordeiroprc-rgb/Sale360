# Templates de Importação — Sale360

Formatos: **CSV com separador `;` (ponto e vírgula)** e encoding **UTF-8**.

> ⚠️ **Importante:** Use ponto-e-vírgula como separador pois os valores decimais usam vírgula (ex: `25,90`).

---

## 🗺️ Sequência de Importação (Siga a Ordem!)

A importação deve seguir uma **ordem de dependência**. Cada etapa depende da anterior. Pule as etapas que não se aplicam à sua loja.

```
  ┌─────────────────────────────────────────────────────────────┐
  │               SEQUÊNCIA CORRETA DE IMPORTAÇÃO               │
  ├──────┬──────────────────────────────────────────────────────┤
  │PASSO │ ARQUIVO                    │ DEPENDE DE             │
  ├──────┼────────────────────────────┼────────────────────────┤
  │  1   │ Templates de Variação      │ (nada)                 │
  │  2   │ Categorias                 │ Templates (se houver)  │
  │  3   │ Fornecedores               │ (nada)                 │
  │  4   │ Produtos Simples           │ Categorias (opcional)  │
  │      │ Produtos com Variações     │ Templates + Categorias │
  │  5   │ Compras ⭐                 │ Fornecedores + Produtos│
  └──────┴────────────────────────────┴────────────────────────┘
```

> ⭐ **Compras é a etapa que gera os lotes de estoque (PEPS/FIFO).** Sem ela, os produtos ficam com estoque zero e sem rastreio de lote. Veja seção 6.

### Resumo do que cada etapa faz

| Etapa | O que é criado no sistema | Rastreio de Lote? |
|--------|---------------------------|:---:|
| 1. Templates | `VariationTemplate` + `VariationDimension` | — |
| 2. Categorias | `Category` | — |
| 3. Fornecedores | `Supplier` | — |
| 4. Produtos | `Product` (+ `ProductVariation` se aplicável) | ❌ |
| 5. Compras | `Purchase` → `PurchaseItem` → `InventoryBatch` → `InventoryMovement` → atualiza `Product.stockQty` | ✅ |

---

## 1. Templates de Variação (`import_templates_variacao.csv`)

Define os templates que agrupam dimensões de variação (ex: Tamanho + Cor). **Só importe se sua loja trabalha com produtos que variam** (roupas, calçados, bebidas).

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

## 2. Categorias (`import_categorias.csv`)

| # | Campo | Obrigatório | Tipo | Descrição |
|---|-------|:-----------:|------|-----------|
| 1 | **Nome** | ✅ | Texto | Nome da categoria (único por loja) |
| 2 | Cor (hex) | ❌ | Cor | Cor em hexadecimal para a UI (ex: `#22c55e`) |
| 3 | Ordem | ❌ | Número | Ordem de exibição (0 = primeiro) |
| 4 | Template de Variação | ❌ | Texto | Nome do template importado no Passo 1 |

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

## 4. Produtos Simples (`import_produtos.csv`)

> Para produtos COM variações (roupas, calçados, bebidas com múltiplos tamanhos/sabores), use `import_produtos_variacoes.csv` (seção 4B).

| # | Campo | Obrigatório | Tipo | Descrição |
|---|-------|:-----------:|------|-----------|
| 1 | **Nome** | ✅ | Texto | Nome do produto |
| 2 | Descrição | ❌ | Texto | Descrição detalhada (IA pode gerar automaticamente) |
| 3 | SKU | ❌ | Texto | Código interno do produto |
| 4 | Código de Barras | ❌ | Número | Código EAN-13 ou similar (pode ser lido pela câmera) |
| 5 | Categoria | ❌ | Texto | Nome exato de uma categoria já cadastrada (Passo 2) |
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

```
Margem Bruta (%) = (Preço de Venda - Custo Unitário - Custo Operacional - (Preço de Venda × Taxa / 100)) / Preço de Venda × 100
```

**Exemplo:** Arroz — Preço R$ 25,90 | Custo R$ 18,50 | Op. R$ 1,20 | Taxa 2,5%
→ Margem = (25,90 - 18,50 - 1,20 - 0,65) / 25,90 × 100 = **21,4%**

> ⚠️ **Importante sobre estoque:** O campo "Estoque Inicial" na importação de produtos (Passo 4) define o `stockQty` inicial do produto, mas **NÃO gera lote de estoque (InventoryBatch) nem registro de compra**. Para ter rastreio PEPS/FIFO completo, importe também as **Compras (Passo 5)**.

---

## 4B. Produtos com Variações (`import_produtos_variacoes.csv`)

Para produtos que possuem variações (roupas, calçados, bebidas). **Cada linha representa UMA variação** do produto. O produto principal é criado automaticamente na primeira linha e as demais linhas adicionam variações a ele.

| # | Campo | Obrigatório | Tipo | Descrição |
|---|-------|:-----------:|------|-----------|
| 1 | **Nome do Produto** | ✅ | Texto | Nome base do produto (igual em todas as linhas do mesmo produto) |
| 2 | Categoria | ❌ | Texto | Nome da categoria (deve ter um template de variação vinculado) |
| 3 | **Preço Base** | ✅ | Decimal | Preço de venda base (ex: `49,90`) |
| 4 | **Dim 1** | ✅ | Texto | Valor da 1ª dimensão. **O nome da coluna deve ser o Rótulo da Dim 1** |
| 5 | Dim 2 | ❌ | Texto | Valor da 2ª dimensão. **O nome da coluna deve ser o Rótulo da Dim 2** |
| 6 | **Qtd** | ✅ | Decimal | Quantidade em estoque desta variação |
| 7 | Preço Extra | ❌ | Decimal | Acréscimo sobre o preço base (ex: G custa `5,00` a mais) — padrão: `0,00` |
| 8 | SKU | ❌ | Texto | Código interno desta variação |
| 9 | Código de Barras | ❌ | Número | Código EAN-13 específico da variação |
| 10 | Estoque Mínimo | ❌ | Decimal | Quantidade que dispara alerta de estoque baixo |

> ⚠️ Os nomes das colunas 4 e 5 devem corresponder exatamente aos **Rótulos** definidos no template de variação (Passo 1).

**Exemplo:** Template Vestuário Infantil (Dim 1 Rótulo=`Tamanho`, Dim 2 Rótulo=`Cor`)

| Nome do Produto | Categoria | Preço Base | Tamanho | Cor | Qtd |
|-----------------|-----------|------------|---------|-----|-----|
| Camiseta Turma da Mônica | Roupas | 49,90 | 2 | Rosa | 5 |
| Camiseta Turma da Mônica | Roupas | 49,90 | 2 | Azul Claro | 8 |
| Camiseta Turma da Mônica | Roupas | 49,90 | 4 | Rosa | 6 |

O sistema criará **1 produto** com **8 variações** (todas as combinações fornecidas).

---

## 5. Compras ⭐ (`import_compras.csv`)

> Esta é a etapa que **gera os lotes de estoque (PEPS/FIFO)** e cria o **histórico de rastreio**.
> 
> Cada linha = um item de uma compra. Linhas com mesmo **Nº Pedido + Fornecedor** são agrupadas na mesma compra.

### O que é criado ao importar compras:

```
Para cada linha do CSV:
  PurchaseItem (item da compra)
       ↓
  InventoryBatch  (lote PEPS — quantity, remainingQty, unitCost, receivedAt)
       ↓
  InventoryMovement (tipo: PURCHASE_IN — auditoria)
       ↓
  Product.stockQty += quantidade (atualiza estoque do produto)
```

| # | Campo | Obrigatório | Tipo | Descrição |
|---|-------|:-----------:|------|-----------|
| 1 | **Nº Pedido** | ✅ | Número | Número sequencial da compra (agrupa itens do mesmo pedido) |
| 2 | **Fornecedor** | ✅ | Texto | Nome exato do fornecedor cadastrado no Passo 3 |
| 3 | **Produto** | ✅ | Texto | Nome exato do produto cadastrado no Passo 4 |
| 4 | Variação | ❌ | Texto | Nome da variação (ex: `2 Rosa`). Deixe vazio se não tiver variação |
| 5 | **Quantidade** | ✅ | Decimal | Quantidade recebida neste lote |
| 6 | **Custo Unitário** | ✅ | Decimal | Preço pago por unidade neste lote (ex: `18,50`) |
| 7 | Preço de Venda | ❌ | Decimal | Preço de venda sugerido (atualiza o preço do produto se informado) |
| 8 | **Data Recebimento** | ✅ | Data | Data de entrada no estoque — determina a ordem PEPS (formato: `DD/MM/AAAA`) |
| 9 | Status | ❌ | Texto | `RECEIVED` (já entrou no estoque), `CONFIRMED` (aguardando), `DRAFT` (rascunho). Padrão: `RECEIVED` |
| 10 | Observação | ❌ | Texto | Notas sobre esta compra |

### Efeito de cada Status

| Status | Gera Lote? | Atualiza Estoque? | Quando usar |
|--------|:---:|:---:|-------------|
| `RECEIVED` | ✅ Sim | ✅ Sim | Mercadoria já recebida — usar na importação inicial |
| `CONFIRMED` | ❌ Não | ❌ Não | Pedido feito, aguardando entrega |
| `DRAFT` | ❌ Não | ❌ Não | Rascunho — não afeta nada |

### Exemplo

```
Nº Pedido;Fornecedor;Produto;Qtd;Custo Unit;Data Receb;Status
1;Distribuidora ABC;Arroz Branco 5kg;50;18,50;24/05/2026;RECEIVED
1;Distribuidora ABC;Feijão Carioca 1kg;30;5,80;24/05/2026;RECEIVED
```

Resultado:
- **1 compra** "Pedido #1 — Distribuidora ABC" com 2 itens
- **2 lotes de estoque** (Arroz: lote de 50un a R$18,50; Feijão: lote de 30un a R$5,80)
- **2 movimentações** de estoque (PURCHASE_IN)
- **Estoque atualizado**: Arroz +50un, Feijão +30un
- **Rastreio PEPS ativo**: quando vender, o sistema consome primeiro o lote mais antigo (pela data de recebimento)

---

## Instruções de Uso

1. **Siga a sequência:** Templates → Categorias → Fornecedores → Produtos → Compras
2. Baixe o template desejado (CSV)
3. Abra no **Excel, Google Sheets ou LibreOffice Calc**
4. **Importante:** Ao salvar, escolha o formato **CSV (separador ponto e vírgula)** e encoding **UTF-8**
5. Preencha os dados — **não remova nem altere a linha de cabeçalho**
6. Campos marcados com `*` são obrigatórios
7. Faça upload do arquivo na respectiva tela do sistema
8. O sistema fará uma **pré-visualização** com validação antes de confirmar a importação
9. **Confira os dados na pré-visualização.** Se houver erros, corrija e reenvie.
