import type { Dict } from './types';

export const pt: Dict = {
  meta: {
    title: 'Simulador de Amortização Antecipada – Crédito Habitação',
    description:
      'Calcula quanto poupas em juros ao amortizar o crédito habitação. Compara reduzir prestação ou prazo, com comissões de reembolso antecipado incluídas. Grátis.',
  },
  hero: {
    h1: 'Simulador de Amortização Antecipada do Crédito Habitação',
    tagline:
      'Descobre quanto poupas em juros ao amortizar antecipadamente — e compara as duas opções: reduzir o prazo ou reduzir a prestação.',
  },
  form: {
    legend: 'Dados do teu crédito',
    capital: 'Capital em Dívida',
    installments: 'Nº de Prestações em Falta',
    rate: 'Taxa de Juro (Spread + Euribor)',
    amortization: 'Valor a Amortizar',
    commission: 'Comissão de reembolso antecipado',
    commissionHelp:
      'Máximo legal: 0,5% em taxa variável, 2% em taxa fixa, sobre o capital reembolsado. Acresce Imposto do Selo de 4% sobre a comissão. O teu contrato pode prever um valor inferior.',
    commissionOptions: {
      none: 'Isento (0%)',
      variable: 'Taxa variável (0,5%)',
      fixed: 'Taxa fixa (2%)',
      custom: 'Outra…',
    },
    customRate: 'Comissão personalizada (%)',
    errors: {
      required: 'Campo obrigatório',
      positive: 'Tem de ser superior a zero',
      integer: 'Tem de ser um número inteiro',
      negative: 'Não pode ser negativo',
      exceedsCapital: 'Não pode ser superior ao capital em dívida',
      invalid: 'Valor inválido',
    },
  },
  scenarios: {
    reduceTerm: {
      title: 'Diminuir Prazo',
      subtitle: 'Mantém a prestação mensal e termina o crédito mais cedo.',
    },
    reduceInstallment: {
      title: 'Diminuir Prestação',
      subtitle: 'Mantém o prazo e passa a pagar uma prestação mais baixa.',
    },
  },
  cards: {
    caption: 'Valores da próxima prestação mensal.',
    current: 'Valores Atuais',
    updated: 'Novos Valores',
    diff: 'Diferença',
    interest: 'Juros',
    principal: 'Capital Amortizado',
    installment: 'Prestação',
    installmentNote: '(juros + capital)',
    remaining: 'Nº de Prestações em Falta',
  },
  banner: {
    saves: 'Poupas {amount} em juros',
    fullPayoff: 'Liquidação total do crédito — deixas de pagar juros.',
    grossInterest: 'Juros poupados',
    commission: 'Comissão',
    stampDuty: 'Imposto do Selo (4%)',
    net: 'Poupança líquida',
  },
  chart: {
    title: 'Capital em dívida ao longo do tempo',
    baseline: 'Sem amortizar',
    scenario: 'Com amortização',
    years: 'anos',
  },
  table: {
    show: 'Ver plano de pagamentos mês a mês',
    hide: 'Esconder plano de pagamentos',
    month: 'Mês',
    interest: 'Juros',
    principal: 'Capital',
    payment: 'Prestação',
    balance: 'Capital em Dívida',
    total: 'Total',
  },
  faq: {
    title: 'Perguntas Frequentes',
    items: [
      {
        q: 'Vale a pena amortizar o crédito habitação?',
        a: 'Em regra, amortizar compensa quando a taxa de juro do crédito é superior ao retorno líquido que conseguirias com esse dinheiro (depósitos, certificados de aforro, investimentos). Antes de amortizar, garante um fundo de emergência. Este simulador mostra exatamente quanto poupas em juros em cada opção.',
      },
      {
        q: 'Devo reduzir o prazo ou a prestação?',
        a: 'Reduzir o prazo poupa mais juros: continuas a pagar a mesma prestação, mas durante menos tempo. Reduzir a prestação dá folga imediata no orçamento mensal, mantendo o prazo. Compara os dois cenários acima — a poupança em juros é normalmente muito superior na redução de prazo.',
      },
      {
        q: 'Quanto custa amortizar antecipadamente em 2026?',
        a: 'Desde 1 de janeiro de 2026, os bancos podem cobrar a comissão de reembolso antecipado: até 0,5% do capital reembolsado em contratos de taxa variável e até 2% em período de taxa fixa, acrescida de Imposto do Selo de 4% sobre a comissão. A isenção temporária para créditos a taxa variável (habitação própria permanente) terminou a 31 de dezembro de 2025. O teu contrato pode prever uma comissão inferior — consulta o preçário do banco.',
      },
      {
        q: 'Preciso de avisar o banco com antecedência?',
        a: 'Sim. A amortização parcial pode ser feita em qualquer momento coincidente com o vencimento de uma prestação, com pré-aviso de 7 dias úteis. O reembolso total exige pré-aviso de 10 dias úteis.',
      },
      {
        q: 'Há situações isentas de comissão?',
        a: 'Sim. Por lei, não há comissão quando o reembolso é motivado por morte, desemprego ou deslocação profissional de um dos titulares. Além disso, o contrato pode simplesmente não prever comissão.',
      },
      {
        q: 'Como é calculada a prestação?',
        a: 'Os bancos portugueses usam o sistema francês: prestações constantes de capital e juros, com taxa mensal igual à TAN (Euribor + spread) a dividir por 12. A simulação assume que a Euribor se mantém constante até ao fim do contrato; nos créditos de taxa variável, a prestação real será revista a cada 3, 6 ou 12 meses.',
      },
      {
        q: 'Os meus dados são guardados?',
        a: 'Não. Todos os cálculos são feitos no teu navegador. Nenhum dado é enviado para servidores, não usamos cookies nem ferramentas de análise.',
      },
    ],
  },
  footer: {
    disclaimer:
      'Esta simulação é meramente informativa e não constitui aconselhamento financeiro. Os valores assumem Euribor constante e podem diferir em cêntimos dos valores do banco devido a arredondamentos e convenções de contagem de dias. Prevalecem sempre o contrato de crédito, a FINE e o preçário do banco.',
    rulesAsOf: 'Regras de comissão em vigor em junho de 2026.',
    byLine: 'Uma ferramenta gratuita da',
  },
  lang: { label: 'Idioma', pt: 'Português', en: 'English' },
  notFound: {
    title: 'Página não encontrada',
    body: 'A página que procuras não existe.',
    back: 'Voltar ao simulador',
  },
};
