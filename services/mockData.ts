import { User, Vote, VotingPool } from "../types";
import { generateId } from "../utils/helpers";

// Mock users
export const users: User[] = [
  {
    id: "1",
    name: "João Silva",
    cpf: "123.456.789-00",
    email: "joao@example.com",
    avatarUrl: "https://randomuser.me/api/portraits/men/1.jpg",
  },
  {
    id: "2",
    name: "Maria Oliveira",
    cpf: "987.654.321-00",
    email: "maria@example.com",
    avatarUrl: "https://randomuser.me/api/portraits/women/1.jpg",
  },
];

// Mock voting pools
export const votingPools: VotingPool[] = [
  {
    id: "1",
    title: "Reforma da Praça Central",
    description:
      "Escolha a melhor opção para a reforma da Praça Central da cidade. A reforma incluirá novos bancos, iluminação e paisagismo.",
    category: "Infraestrutura",
    imageUrl: "https://images.unsplash.com/photo-1594383284387-4d6d7064301b",
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
    options: [
      {
        id: "1-1",
        text: "Projeto Moderno",
        description: "Estilo minimalista com materiais sustentáveis",
        imageUrl:
          "https://images.unsplash.com/photo-1596645655316-4720e705b277",
        voteCount: 42,
      },
      {
        id: "1-2",
        text: "Projeto Tradicional",
        description: "Preservação do estilo histórico da cidade",
        imageUrl:
          "https://images.unsplash.com/photo-1605128179482-56197f2dd27e",
        voteCount: 38,
      },
      {
        id: "1-3",
        text: "Projeto Ecológico",
        description: "Foco em áreas verdes e energia renovável",
        imageUrl:
          "https://images.unsplash.com/photo-1623171439880-7410f257fe6f",
        voteCount: 67,
      },
    ],
    location: {
      latitude: -23.55052,
      longitude: -46.633308,
      address: "Praça da Sé, Centro, São Paulo - SP",
    },
    status: "active",
    anonymous: true,
  },
  {
    id: "2",
    title: "Nova Ciclovia",
    description:
      "Vote na rota preferida para a nova ciclovia que conectará o centro aos bairros residenciais.",
    category: "Mobilidade",
    imageUrl: "https://images.unsplash.com/photo-1517649763962-0c623066013b",
    startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    endDate: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000).toISOString(), // 27 days from now
    options: [
      {
        id: "2-1",
        text: "Rota A - Via Marginal",
        description: "Paralela ao rio, mais plana e direta",
        imageUrl:
          "https://images.unsplash.com/photo-1571068316344-75bc76f77890",
        voteCount: 58,
      },
      {
        id: "2-2",
        text: "Rota B - Via Central",
        description: "Passa pelo centro comercial, maior integração urbana",
        imageUrl:
          "https://images.unsplash.com/photo-1519575706483-221027bfbb31",
        voteCount: 73,
      },
    ],
    location: {
      latitude: -23.562254,
      longitude: -46.654622,
      address: "Av. Paulista, Bela Vista, São Paulo - SP",
    },
    status: "active",
    anonymous: false,
  },
  {
    id: "3",
    title: "Novo Sistema de Iluminação Pública",
    description:
      "Escolha entre diferentes opções de iluminação para as ruas da cidade. Considere eficiência energética e segurança.",
    category: "Infraestrutura",
    imageUrl: "https://images.unsplash.com/photo-1604335399105-a0c585fd81a1",
    startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Starts in 7 days
    endDate: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000).toISOString(), // Ends in 37 days
    options: [
      {
        id: "3-1",
        text: "LED de Alta Eficiência",
        description: "Maior economia de energia e vida útil",
        imageUrl:
          "https://images.unsplash.com/photo-1507159524415-81b2252db8c8",
        voteCount: 0,
      },
      {
        id: "3-2",
        text: "Iluminação Solar",
        description: "Energia renovável e independência da rede elétrica",
        imageUrl:
          "https://images.unsplash.com/photo-1605292356963-b8c9b0b4ee11",
        voteCount: 0,
      },
      {
        id: "3-3",
        text: "Sistema Inteligente",
        description: "Ajuste automático da luminosidade conforme movimento",
        imageUrl:
          "https://images.unsplash.com/photo-1613310023042-ad79320c00ff",
        voteCount: 0,
      },
    ],
    location: {
      latitude: -23.589777,
      longitude: -46.673236,
      address: "Pinheiros, São Paulo - SP",
    },
    status: "upcoming",
    anonymous: true,
  },
  {
    id: "4",
    title: "Orçamento Participativo 2024",
    description:
      "Como você gostaria que fosse distribuído o orçamento municipal para o próximo ano?",
    category: "Administração",
    imageUrl: "https://images.unsplash.com/photo-1579621970588-a35d0e7ab9b6",
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Started 30 days ago
    endDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // Ended 2 days ago
    options: [
      {
        id: "4-1",
        text: "Prioridade para Educação",
        description: "Maior investimento em escolas e capacitação",
        voteCount: 145,
      },
      {
        id: "4-2",
        text: "Prioridade para Saúde",
        description: "Ampliação de postos de saúde e hospitais",
        voteCount: 187,
      },
      {
        id: "4-3",
        text: "Prioridade para Infraestrutura",
        description: "Melhorias em estradas, pontes e edifícios públicos",
        voteCount: 96,
      },
      {
        id: "4-4",
        text: "Distribuição Equilibrada",
        description: "Divisão proporcional entre todas as áreas",
        voteCount: 134,
      },
    ],
    status: "closed",
    anonymous: false,
  },
];

// Mock votes
export const votes: Vote[] = [
  {
    id: generateId(),
    userId: "1",
    poolId: "1",
    optionId: "1-3",
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: generateId(),
    userId: "1",
    poolId: "2",
    optionId: "2-2",
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: generateId(),
    userId: "1",
    poolId: "4",
    optionId: "4-2",
    timestamp: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
