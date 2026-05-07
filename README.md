# Configuração da Integração GLPI

Para que os tickets do GLPI apareçam no dashboard, siga estes passos:

1.  No painel lateral do editor de código, localize o ficheiro `.env.example`.
2.  Copie o conteúdo de `.env.example` para um novo ficheiro chamado `.env` (se ainda não existir).
3.  No ficheiro `.env`, substitua os valores `COLOCAR_TOKEN_AQUI` pelos tokens reais gerados no seu GLPI:
    *   `VITE_GLPI_APP_TOKEN`: O token de aplicação configurado no GLPI.
    *   `VITE_GLPI_USER_TOKEN`: O token pessoal do utilizador da API.
4.  Após guardar o ficheiro `.env`, a plataforma irá detetar as alterações. Recomenda-se clicar no botão **"Testar GLPI API"** no painel de diagnóstico para validar a ligação.

## Requisitos
- O URL deve terminar em `/apirest.php`.
- O servidor GLPI deve permitir ligações externas (CORS ou via backend).
- O utilizador associado ao token deve ter permissão de leitura de chamados.
