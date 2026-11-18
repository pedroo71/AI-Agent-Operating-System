# Agent OS — SEO_SPEC

Ferramenta interna e local: o objetivo é **não ser indexada** e ter metadados corretos. Página única `/`.

## 1. `<head>` (obrigatório)
```html
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <title>Agent OS — painel ao vivo da equipa de agentes</title>
  <meta name="description" content="Painel local, só de leitura, para acompanhar ao vivo o que os agentes do Claude Code estão a fazer.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <meta name="theme-color" content="#16181d">
  <meta name="color-scheme" content="dark">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
</head>
```
- Título: 47 caracteres (≤ 60). Descrição: ≤ 155 caracteres.
- `<html lang="pt-PT">` (exatamente este valor).
- `theme-color` igual ao fundo grafite do ambiente de trabalho (ajustar o hex se o CSS usar outro; manter coerência).
- Favicon: SVG simples (ex.: quadrado arredondado grafite com um ponto de pulso ciano). Sem PNG/apple-touch obrigatórios.
- Um único `<h1>` na página, pode estar visualmente oculto (`sr-only`): "Agent OS".
- Elementos interativos com `aria-label` em pt-PT; indicador ao vivo com `role="status"` e `aria-live="polite"`.

## 2. Indexação
- Meta `robots` acima **e** cabeçalho HTTP `X-Robots-Tag: noindex, nofollow` em todas as respostas (HTML e `/api/*`).
- `GET /robots.txt` devolve:
  ```
  User-agent: *
  Disallow: /
  ```
- **Sem** `sitemap.xml`, **sem** `<link rel="canonical">` (nada a consolidar), **sem** dados estruturados.
- Open Graph / Twitter Cards: **não necessários** — a página nunca é partilhada nem pré-visualizada; só corre em localhost.
- Desempenho: sem metas formais; apenas evitar bloquear a renderização (fontes com `font-display: swap`).

## 3. Microcopy pt-PT

### Indicador ao vivo (barra de tarefas, global)
| Estado | Texto | `title`/aria |
|---|---|---|
| Ligado | Ao vivo | Ligação em direto ativa |
| A ligar | A ligar… | A estabelecer ligação ao servidor |
| Desligado | Desligado | Sem ligação. A tentar voltar a ligar… |
| Servidor parado | Servidor indisponível | Não foi possível contactar o servidor local |

Cada janela mostra, no canto da barra de título, o mesmo indicador em versão curta (ponto + "Ao vivo" / "Desligado").
Quando desligado, o conteúdo mantém-se visível com a faixa: "Sem ligação — a mostrar os últimos dados recebidos."
Ao recuperar: "Ligação reposta." (desaparece após 3 s).

### Estados dos agentes
ativo · inativo · terminado (minúsculas nos cartões).

### Por janela
| Janela | Vazio | Erro | Desligado |
|---|---|---|---|
| **Agentes** | Nenhum agente nesta sessão. Os agentes aparecem aqui assim que começarem a trabalhar. | Não foi possível carregar os agentes. | Agentes: sem ligação em direto. |
| **Linha temporal** | Ainda sem eventos para este agente. | Não foi possível carregar a linha temporal deste agente. | Linha temporal: sem ligação em direto. |
| **Feed** | Ainda sem atividade. Os eventos aparecem aqui em direto. (com filtro ativo: Nenhum evento corresponde aos filtros. + botão "Limpar filtros") | Não foi possível carregar o feed de atividade. | Feed: sem ligação em direto. |
| **Tarefas** | Sem tarefas partilhadas para esta sessão. | Não foi possível ler a lista de tarefas. | Tarefas: sem ligação em direto. |
| **Projetos** | Nenhum projeto encontrado em `projects/`. | Não foi possível ler os projetos. | Projetos: sem ligação em direto. |
| **Memória** | Este agente ainda não tem memória guardada. | Não foi possível ler a memória. | Memória: sem ligação em direto. |

### Erros e estados globais
- Sem sessão: "Nenhuma sessão encontrada. Confirme que `CLAUDE_HOME` aponta para a pasta `.claude` correta." (botão Início/seletor de sessão desativado)
- Pasta não encontrada: "Pasta do Claude Code não encontrada: {caminho}."
- Erro genérico: "Algo correu mal. Tente novamente." + botão "Tentar novamente".
- A carregar: "A carregar…" (skeleton nas janelas).
- Estados de tarefa: pendente · em curso · concluída. Entregáveis: "existe" / "em falta".
- Bugs: "{n} bugs abertos" / "Sem bugs abertos".
- Resultado de ferramenta: "ok" / "erro".
- Botões: Fechar · Minimizar · Início · Limpar filtros · Tentar novamente.
- Seletor de sessão: "Sessão" com a opção por omissão "Mais recente (product-team)".
- Mobile (< 768 px): sem alteração de texto.

Tom: curto, impessoal ou tratamento por "confirme/tente" (imperativo neutro), sem "você", sem gerúndios brasileiros.
