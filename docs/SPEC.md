Você é um engenheiro de software sênior trabalhando de forma AUTÔNOMA.

Construa um MVP completo, testado e deploy-ready chamado:

# AI Web Reading Benchmark

O objetivo é medir quão bem diferentes IAs conseguem ler uma página web e extrair/compreender informações dela.

As IAs iniciais são:

- Gemini
- ChatGPT
- Claude

O projeto deve ser suficientemente pequeno para ser implementado, testado e preparado para produção em aproximadamente 5 horas.

==================================================
1. STACK
==================================================

Frontend:

- Next.js
- TypeScript
- Tailwind CSS
- Vitest
- React Testing Library
- Playwright
- ESLint

Deploy:
- Vercel

Backend:

- Node.js
- TypeScript
- Fastify
- Vitest
- Fastify inject para testes HTTP
- Zod para validação
- biblioteca madura de Readability/HTML parsing
- ESLint
- Prettier

Deploy:
- Railway

Arquitetura:

/
  frontend/
  backend/
  README.md
  package.json
  .gitignore

Use TypeScript strict.

Não faça overengineering.

==================================================
2. OBJETIVO DO PRODUTO
==================================================

O usuário informa uma URL.

Exemplo:

https://example.com/article

O sistema:

1. valida a URL;
2. busca a página;
3. extrai o conteúdo principal;
4. cria um pequeno conjunto de perguntas;
5. envia as mesmas informações para Gemini, ChatGPT e Claude;
6. coleta as respostas;
7. avalia as respostas;
8. apresenta os resultados lado a lado.

O produto deve deixar explícito que se trata de um benchmark experimental e que os resultados dependem:

- da página;
- das perguntas;
- dos modelos;
- do método de avaliação.

==================================================
3. ESCOPO FUNCIONAL
==================================================

Endpoint:

GET /api/health

POST /api/benchmark

Input:

{
  "url": "https://example.com"
}

Output:

{
  "url": "...",
  "page": {
    "title": "...",
    "wordCount": 1234
  },
  "questions": [],
  "results": {
    "gemini": {},
    "openai": {},
    "claude": {}
  }
}

==================================================
4. AI PROVIDERS
==================================================

Criar uma abstração:

interface AIProvider {
  name: string;
  model: string;

  answer(input: {
    pageContent: string;
    question: string;
  }): Promise<string>;
}

Implementar:

GeminiProvider
OpenAIProvider
ClaudeProvider

Usar os SDKs oficiais.

Environment variables:

GEMINI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

Nenhuma API key pode chegar ao frontend.

Se uma API key não existir:

- não quebrar o benchmark;
- marcar o provider como unavailable;
- continuar executando os demais.

As chamadas devem ocorrer em paralelo.

Criar configuração centralizada para modelos.

==================================================
5. WEB SCRAPING
==================================================

Usar biblioteca madura para extrair conteúdo principal.

Não criar parser HTML próprio.

Extrair:

- title
- headings
- main text
- metadata quando disponível

Remover conteúdo irrelevante como:

- script
- style
- navegação
- elementos claramente não pertencentes ao artigo/conteúdo.

Definir limite máximo de conteúdo enviado às APIs.

Adicionar timeout.

==================================================
6. SEGURANÇA DO SCRAPER
==================================================

O usuário controla a URL.

Implementar proteção básica contra SSRF.

Bloquear:

- localhost
- 127.0.0.1
- ::1
- 0.0.0.0
- redes privadas
- file://
- javascript://
- data://
- esquemas diferentes de HTTP/HTTPS

Validar URL antes do fetch.

Adicionar timeout.

Limitar tamanho da resposta.

Não seguir redirects para destinos bloqueados.

Se a biblioteca escolhida não fizer isso automaticamente, implementar essa validação explicitamente.

Criar testes específicos para SSRF.

==================================================
7. BENCHMARK
==================================================

O benchmark inicial deve possuir três categorias:

EXTRACTION
- extração de informação explícita.

COMPREHENSION
- entendimento de uma informação presente no texto.

RELATION
- relação entre duas informações presentes na página.

Ter aproximadamente 5 perguntas por benchmark.

Não criar um sistema complexo de geração automática de perguntas.

A prioridade é:

reprodutibilidade > complexidade.

Quando não houver informação suficiente para avaliar uma pergunta:

- marcar como not evaluable;
- não inventar gabarito.

==================================================
8. SCORING
==================================================

Criar uma camada independente:

evaluation/

Ela deve receber:

question
expectedAnswer
actualAnswer

e produzir:

CORRECT
PARTIAL
INCORRECT
NOT_EVALUABLE

Score:

CORRECT = 1
PARTIAL = 0.5
INCORRECT = 0

Não apresentar a pontuação como verdade absoluta.

Se for necessário usar LLM-as-a-judge para perguntas abertas:

- isolar essa funcionalidade;
- documentar claramente;
- permitir substituição do judge;
- testar o comportamento com mocks.

==================================================
9. FRONTEND
==================================================

Criar uma página única.

Título:

AI Web Reading Benchmark

Descrição:

"Teste quão bem diferentes IAs conseguem ler e extrair informações de uma página web."

Campo:

URL

Botão:

Run Benchmark

Durante execução:

Fetching page...
Extracting content...
Running Gemini...
Running ChatGPT...
Running Claude...
Evaluating answers...

Resultado:

- URL
- título
- quantidade de palavras
- score por categoria
- score geral
- respostas individuais

Tabela:

Question | Gemini | ChatGPT | Claude

Não esconder resultados.

Não criar ranking editorial ou julgamento subjetivo dos modelos.

==================================================
10. ARQUITETURA DE TESTES
==================================================

TESTES NÃO SÃO UMA ETAPA FINAL.

Toda funcionalidade implementada deve ser acompanhada por testes.

A pirâmide mínima:

                    SYSTEM / E2E
                  SMOKE / REGRESSION
                INTEGRATION TESTS
              UNIT + MUTATION TESTS

==================================================
11. TESTE UNITÁRIO
==================================================

Usar:

Vitest

Cobrir principalmente:

- URL validation
- SSRF validation
- content extraction
- question generation
- scoring
- normalization
- provider adapters
- configuration
- error handling

Testes devem ser rápidos e determinísticos.

Não utilizar APIs reais nos testes unitários.

Mockar:

- HTTP
- AI providers
- filesystem quando necessário
- timers quando necessário.

==================================================
12. TESTE DE INTEGRAÇÃO
==================================================

Backend:

usar Fastify inject.

Testar:

POST /api/benchmark

com:

- URL válida
- URL inválida
- página válida
- página vazia
- erro de scraping
- provider indisponível
- provider retornando erro
- múltiplos providers
- timeout

As APIs externas devem ser mockadas.

O teste deve verificar o fluxo:

HTTP
→ validation
→ scraping
→ benchmark
→ providers
→ evaluation
→ response

==================================================
13. TESTE DE REGRESSÃO
==================================================

Criar fixtures determinísticas de páginas HTML.

Exemplo:

tests/fixtures/article.html

O benchmark deve ser executado contra essas fixtures.

Criar snapshots ou assertions explícitas para:

- title
- extracted content
- questions
- scoring
- API response shape

Sempre que um bug for corrigido:

1. reproduzir o bug;
2. adicionar teste;
3. corrigir implementação;
4. manter o teste como regressão permanente.

Criar comando:

npm run test:regression

==================================================
14. TESTE DE MUTAÇÃO
==================================================

Usar uma ferramenta adequada ao TypeScript, preferencialmente:

StrykerJS

Configurar mutation testing principalmente para:

- validation
- scoring
- SSRF protection
- benchmark orchestration

Não tentar aplicar mutation testing indiscriminadamente a todo o projeto se isso inviabilizar o tempo de execução.

Definir um mutation threshold razoável.

Comando:

npm run test:mutation

O pipeline deve falhar se o mutation score ficar abaixo do threshold definido.

Documentar o threshold no README.

==================================================
15. TESTE DE ESPECIFICAÇÃO
==================================================

Transformar os requisitos principais em testes executáveis.

Pode utilizar:

Vitest + arquivos de specification tests

ou

Cucumber/Gherkin somente se isso não adicionar complexidade excessiva.

Preferência:

não adicionar Cucumber apenas por adicionar.

Criar especificações para:

- usuário informa URL válida;
- sistema extrai página;
- sistema executa benchmark;
- três providers podem responder;
- provider indisponível não quebra o benchmark;
- resultado é apresentado.

Comando:

npm run test:spec

==================================================
16. TESTE DE SEGURANÇA
==================================================

Implementar pelo menos:

- SSRF tests
- invalid URL tests
- oversized input tests
- malformed HTML tests
- malicious HTML tests
- prompt injection awareness tests
- secret exposure tests

Testar que API keys:

NUNCA aparecem:

- no HTML
- no JSON retornado
- no código do frontend
- nos logs.

Usar ferramentas adequadas:

- npm audit
- Semgrep, se disponível de maneira simples
- Gitleaks para secrets
- testes de segurança próprios

Não introduzir uma ferramenta pesada apenas para cumprir checklist.

Comandos:

npm run test:security
npm run security:audit

==================================================
17. TESTE DE FUMAÇA
==================================================

Criar smoke tests que respondam rapidamente:

- backend inicia;
- /api/health retorna 200;
- frontend inicia;
- frontend consegue carregar;
- endpoint principal responde com fixture/mocks.

Comando:

npm run test:smoke

Smoke tests devem ser executados antes dos testes mais demorados.

==================================================
18. TESTE DE SISTEMA / E2E
==================================================

Usar:

Playwright

Testar o sistema completo:

Browser
→ Frontend
→ Backend
→ Mock AI providers
→ Resultado

Não usar APIs reais no CI.

Cenário principal:

1. abrir aplicação;
2. inserir URL;
3. executar benchmark;
4. aguardar resultado;
5. verificar Gemini;
6. verificar ChatGPT;
7. verificar Claude;
8. verificar scores.

Também testar:

- URL inválida;
- erro do backend;
- provider indisponível.

Comando:

npm run test:e2e

==================================================
19. LINT
==================================================

Usar ESLint.

Configurar para TypeScript e Next.js.

Comando:

npm run lint

Não aceitar:

- unused variables
- imports inválidos
- erros de React
- problemas TypeScript conhecidos.

==================================================
20. FORMATAÇÃO
==================================================

Usar Prettier.

Comando:

npm run format:check

==================================================
21. TIPAGEM
==================================================

TypeScript strict.

Executar:

npm run typecheck

Não aceitar erros de TypeScript.

Evitar:

any

quando houver alternativa razoável.

==================================================
22. DEAD CODE
==================================================

Adicionar ferramenta adequada para detectar código morto.

Preferência:

Knip

Executar:

npm run dead-code

O pipeline deve falhar para código morto claramente detectado.

Se uma exceção legítima existir, documentá-la explicitamente.

Não adicionar código apenas para satisfazer a ferramenta.

==================================================
23. SONARQUBE
==================================================

Integrar SonarQube ao processo local.

O projeto deve possuir:

sonar-project.properties

Configurar análise para:

- bugs
- vulnerabilities
- code smells
- duplication
- coverage
- maintainability
- reliability
- security

Usar cobertura de testes gerada pelo Vitest.

Metas mínimas:

- Coverage >= 80%
- Duplication <= 3%
- Cognitive complexity <= 15
- Cyclomatic complexity <= 10
- Technical debt <= 5%

Não criar complexidade artificial apenas para satisfazer métricas.

O código deve ser refatorado quando necessário.

Se SonarQube local estiver disponível:

npm run quality:sonar

Se não estiver disponível, o script deve explicar claramente como iniciar/configurar o SonarQube.

Não fingir que uma análise SonarQube foi executada quando o servidor não estiver disponível.

==================================================
24. CI/CD LOCAL
==================================================

ANTES DE CADA PUSH, executar obrigatoriamente um pipeline local.

Criar:

npm run ci

Esse comando deve executar, na ordem apropriada:

1. clean
2. install/verify dependencies
3. typecheck
4. lint
5. format check
6. dead-code
7. unit tests
8. integration tests
9. regression tests
10. specification tests
11. security tests
12. smoke tests
13. mutation tests
14. build
15. system/e2e tests
16. coverage verification
17. SonarQube analysis quando disponível

O pipeline deve:

- parar quando uma etapa obrigatória falhar;
- retornar exit code != 0;
- nunca mascarar erros.

Criar também comandos individuais:

npm run test:unit
npm run test:integration
npm run test:regression
npm run test:mutation
npm run test:spec
npm run test:security
npm run test:smoke
npm run test:e2e
npm run typecheck
npm run lint
npm run dead-code
npm run quality:sonar
npm run ci

==================================================
25. PRE-PUSH
==================================================

Configurar um git pre-push hook.

Preferencialmente usar:

Husky

O hook deve executar:

npm run ci

Se qualquer etapa falhar:

git push deve ser bloqueado.

IMPORTANTE:

Não permitir bypass silencioso.

Documentar que:

git push --no-verify

não faz parte do fluxo normal do projeto.

==================================================
26. TESTES COM APIs EXTERNAS
==================================================

NUNCA executar testes normais contra:

- OpenAI real
- Gemini real
- Anthropic real

Isso causaria:

- custos;
- instabilidade;
- testes não determinísticos.

Criar mock providers.

Opcionalmente criar:

npm run test:live

para um teste manual contra APIs reais.

Esse comando:

- nunca deve ser executado pelo CI normal;
- deve exigir explicitamente environment variables;
- deve deixar claro que pode gerar custos.

==================================================
27. DEPLOY
==================================================

Backend:

Railway.

Frontend:

Vercel.

Preparar:

backend/.env.example
frontend/.env.example

Backend:

PORT
FRONTEND_URL
GEMINI_API_KEY
OPENAI_API_KEY
ANTHROPIC_API_KEY

Frontend:

NEXT_PUBLIC_API_URL

Nunca colocar secrets em NEXT_PUBLIC_*.

==================================================
28. BUILD
==================================================

Antes de considerar o projeto pronto:

npm run build

deve funcionar.

Verificar:

- frontend build
- backend build

==================================================
29. GIT
==================================================

Criar commits pequenos e semanticamente organizados quando apropriado.

Exemplo:

feat: add web content extraction
feat: add ai providers
test: add benchmark integration tests
test: add regression fixtures
test: add mutation testing
chore: configure quality gates

Não fazer um único commit gigante se isso puder ser evitado.

==================================================
30. DOCUMENTAÇÃO
==================================================

README.md deve conter:

- objetivo
- arquitetura
- stack
- instalação
- environment variables
- execução local
- testes
- CI local
- pre-push
- SonarQube
- mutation testing
- security testing
- deploy Railway
- deploy Vercel
- limitações

Adicionar tabela:

| Comando | Função |
|---|---|
| npm run dev | desenvolvimento |
| npm run test:unit | testes unitários |
| npm run test:integration | integração |
| npm run test:regression | regressão |
| npm run test:mutation | mutação |
| npm run test:spec | especificação |
| npm run test:security | segurança |
| npm run test:smoke | fumaça |
| npm run test:e2e | sistema |
| npm run typecheck | tipagem |
| npm run lint | lint |
| npm run dead-code | dead code |
| npm run quality:sonar | SonarQube |
| npm run ci | pipeline completo |

==================================================
31. ESTRATÉGIA DE IMPLEMENTAÇÃO
==================================================

Trabalhe nesta ordem:

FASE 1 — Bootstrap

- estrutura monorepo
- package.json
- TypeScript
- lint
- prettier
- testing
- scripts

FASE 2 — Backend mínimo

- Fastify
- health
- validation
- scraper
- benchmark domain

FASE 3 — Providers

- Gemini
- OpenAI
- Claude
- mock providers

FASE 4 — Evaluation

- questions
- scoring
- result model

FASE 5 — Tests

- unit
- integration
- regression
- specification
- security

FASE 6 — Quality

- mutation
- dead-code
- coverage
- SonarQube
- pre-push

FASE 7 — Frontend

- UI
- API integration
- loading
- errors
- results

FASE 8 — System tests

- Playwright
- smoke
- full E2E

FASE 9 — Production

- production build
- Railway configuration
- Vercel configuration
- README

==================================================
32. PRINCÍPIO FUNDAMENTAL
==================================================

NÃO escreva código primeiro e testes depois.

Para cada componente importante:

1. definir comportamento;
2. escrever teste;
3. implementar;
4. executar teste;
5. refatorar;
6. executar qualidade.

O código somente deve ser considerado terminado quando os testes correspondentes existirem e passarem.

==================================================
33. REQUISITO FINAL
==================================================

Antes de terminar, execute:

npm run ci

Corrija TODOS os problemas encontrados.

Depois execute novamente:

npm run ci

Somente considere a implementação concluída quando o pipeline estiver verde.

No final, apresente:

1. arquitetura final;
2. arquivos principais;
3. ferramentas escolhidas e justificativa;
4. quantidade de testes por categoria;
5. coverage;
6. mutation score;
7. resultado do lint;
8. resultado do typecheck;
9. resultado do dead-code;
10. resultado do SonarQube;
11. resultado do build;
12. resultado do E2E;
13. limitações;
14. instruções de deploy Railway;
15. instruções de deploy Vercel.

NUNCA invente resultados de testes.

Se uma ferramenta não pôde ser executada, informe:

NOT RUN — motivo

em vez de afirmar que passou.