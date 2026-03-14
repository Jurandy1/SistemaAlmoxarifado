# Deploy no GitHub Pages (passo a passo)

## 1) Pré-requisitos

- Repositório público (ou conta GitHub com Pages para repositórios privados).
- Branch principal: `main` ou `master`.

## 2) Subir as alterações

Inclua estes arquivos no commit:

- `.github/workflows/pages.yml`
- `.nojekyll`

Depois faça `push` para o GitHub.

## 3) Habilitar Pages

No GitHub do repositório:

1. **Settings → Pages**
2. Em **Build and deployment**
   - **Source**: selecione **GitHub Actions**

## 4) Acompanhar o deploy

1. Vá em **Actions**
2. Abra o workflow **Deploy to GitHub Pages**
3. Aguarde ficar verde (sucesso)

Depois, em **Settings → Pages**, aparecerá a URL publicada.

## 5) URL correta

- Se o repositório chama `meu-repo`:
  - `https://SEU_USUARIO.github.io/meu-repo/`

- Se o repositório chama `SEU_USUARIO.github.io`:
  - `https://SEU_USUARIO.github.io/`

## 6) Se aparecer “Service is unavailable”

Checklist (em ordem):

1. **Settings → Pages** está como **GitHub Actions** (não “Deploy from a branch”).
2. O workflow em **Actions** rodou e finalizou com sucesso.
3. Espere 2–10 minutos (propagação do Pages).
4. Repositório privado sem Pages habilitado na conta pode impedir publicação.
5. Verifique se você está acessando a URL correta (com o nome do repo no caminho).

