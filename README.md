# Mapa Interativo (versão online)

Este pacote é a versão **web** do seu aplicativo (sem Electron), pronta para hospedar grátis no **GitHub Pages** e embutir no Notion.

## O que funciona
- Abrir/Salvar projeto em **JSON** (import/export)  
- Importar imagem (somente quando o projeto estiver vazio)  
- Exportar PNG  
- Presets, marcadores, zoom/pan, undo (conforme a versão atual do app)

## 1) Criar conta e repositório no GitHub
1. Acesse o GitHub e crie uma conta (se ainda não tiver).
2. Clique em **New repository**.
3. Nome do repositório: `mapa-interativo` (ou qualquer nome).
4. Marque **Public**.
5. Clique em **Create repository**.

## 2) Enviar os arquivos para o repositório (modo mais simples)
1. Abra o repositório que você criou.
2. Clique em **Add file → Upload files**.
3. Arraste **todos** estes arquivos para a tela do GitHub:
   - `index.html`
   - `styles.css`
   - `renderer.js`
   - `icon.ico` (opcional)
4. Clique em **Commit changes**.

## 3) Ativar o GitHub Pages (hospedagem grátis)
1. No seu repositório, clique em **Settings**.
2. No menu da esquerda, clique em **Pages**.
3. Em **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main`
   - **Folder**: `/ (root)`
4. Clique em **Save**.
5. O GitHub vai mostrar um link do tipo:
   - `https://SEUUSUARIO.github.io/NOME-DO-REPO/`

Dica: pode demorar 1–5 minutos para o link ficar ativo na primeira vez.

## 4) Usar dentro do Notion (Embed)
1. No Notion, digite `/embed`.
2. Cole a URL do GitHub Pages (a que termina com `/nome-do-repo/`).
3. Ajuste o bloco para **Full width** e aumente a altura (700–900px).

## 5) Como importar/exportar JSON na versão online
- **Salvar Projeto**: baixa um arquivo `.json` no seu computador.
- **Abrir Projeto**: seleciona o `.json` salvo anteriormente.

Observação: no navegador, o download vai para a pasta padrão do seu browser (geralmente “Downloads”).

## 6) Problemas comuns
### “O atalho Ctrl+S / Ctrl+O não funciona”
Clique uma vez dentro do app (no canvas) para dar foco.  
Dentro do Notion (iframe), isso é normal.

### “A página abriu em branco”
Confirme que:
- você enviou os 3 arquivos (`index.html`, `styles.css`, `renderer.js`)
- ativou Pages em **main** e **/(root)**

## 7) Atualizar o site no futuro
Sempre que você fizer upload de uma nova versão dos arquivos e clicar em **Commit changes**, o GitHub Pages atualiza automaticamente.

---
Se quiser, você pode usar um domínio próprio depois, mas não é necessário para funcionar.
