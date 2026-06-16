# Easy Access — Gerenciador de Credenciais

Sistema interno de gerenciamento de credenciais, desenvolvido com React, Tailwind CSS e Supabase.

## Funcionalidades

- Autenticação com aprovação de novos usuários por Super Admin
- Três níveis de acesso: Super Admin, Admin e Básico
- Sessão encerrada automaticamente após 8 horas
- Gestão de empresas e credenciais
- Tipos de credencial: Hospedagem, Servidor, Registro.br, WordPress, RD Station, FTP/SSH, MySQL
- Busca e filtros por tipo
- Interface responsiva (desktop e mobile)
- Copiar login/senha com um clique

## Instalação

```bash
npm install
```

## Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_aqui
```

> As chaves do Supabase ficam no painel em **Settings → API**.

## Executar

```bash
# Desenvolvimento
npm run dev

# Build
npm run build

# Deploy (GitHub Pages)
npm run deploy
```

## Perfis de acesso

| Perfil | Permissões |
|---|---|
| **Super Admin** | Tudo + aprovar/rejeitar usuários + gerenciar roles |
| **Admin** | Criar e editar empresas e credenciais (sem deletar) + convidar usuários básico |
| **Básico** | Somente visualização |

> Super Admins só podem ser criados diretamente no banco de dados.

## Tecnologias

- React 18 + Vite
- Tailwind CSS
- Supabase (Auth + Database + RLS)
- React Router
- Lucide React

## Segurança

- Row Level Security (RLS) no banco de dados
- Usuários pendentes não acessam dados mesmo com sessão válida
- Sessão expira em 8 horas (frontend + JWT do Supabase)
- Super Admin criado apenas via banco de dados
