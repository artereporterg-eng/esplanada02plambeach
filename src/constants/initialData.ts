import { Room, User as UserType, CompanyConfig, TaxConfig, MenuItem } from '../types';

export const TAX_IVA_14: TaxConfig = { 
  type: 'IVA', 
  rate: 14, 
  code: 'NOR', 
  description: 'IVA Taxa Normal 14%' 
};

export const TAX_IVA_EXEMPT: TaxConfig = { 
  type: 'IVA', 
  rate: 0, 
  code: 'ISE', 
  description: 'Isento', 
  exemptionCode: 'M02', 
  exemptionReason: 'Isento nos termos do artigo 12.º do Código do IVA' 
};

export const TAX_IS_1: TaxConfig = { 
  type: 'IS', 
  rate: 1, 
  code: 'IS', 
  description: 'Imposto de Selo 1%' 
};

export const MOCK_COMPANY: CompanyConfig = {
  name: 'Pérola do Oceano Resort',
  nif: '5000123456',
  phone: '+244 923 000 000',
  email: 'contacto@peroladooceano.com',
  address: 'Av. Marginal, Luanda, Angola',
  currency: 'Kz',
  logo: '',
  defaultWithholdingRate: 6.5,
  billingSeries: [
    { id: 'AGT', name: 'Série Geral', prefix: 'AGT', nextNumber: 1, isDefault: true },
    { id: 'RES', name: 'Série Reservas', prefix: 'RES', nextNumber: 1 }
  ]
};

export const MOCK_ROOMS: Room[] = [
  { number: '101', type: 'suite', price: 450, status: 'occupied' },
  { number: '102', type: 'deluxe', price: 300, status: 'available' },
  { number: '103', type: 'double', price: 200, status: 'maintenance' },
  { number: '201', type: 'suite', price: 500, status: 'available' },
  { number: '202', type: 'single', price: 150, status: 'available' },
];

export const MOCK_USERS: UserType[] = [
  { id: '1', username: 'admin', password: '123', role: 'admin', name: 'Administrador' },
  { id: '2', username: 'recepcao', password: '123', role: 'rooms_user', name: 'Recepcionista Quartos' },
  { id: '3', username: 'bar', password: '123', role: 'bar_user', name: 'Atendente Bar' },
  { id: '4', username: 'eventos', password: '123', role: 'events_user', name: 'Gestor Eventos' },
  { id: '5', username: 'rh', password: '123', role: 'hr_user', name: 'Gestor RH' },
];

export const DEFAULT_MENU: { [key: string]: MenuItem[] } = {
  Bebidas: [
    { id: 'c1', name: 'Cocktail Pérola', price: 12, description: 'Especialidade da casa com frutas tropicais', img: 'https://picsum.photos/seed/cocktail/300/300', stock: 50, taxConfig: TAX_IVA_14 },
    { id: 'c2', name: 'Vinho Tinto Reserva', price: 25, description: 'Garrafa 750ml de Setúbal', img: 'https://picsum.photos/seed/wine/300/300', stock: 24, taxConfig: TAX_IVA_14 },
    { id: 'c3', name: 'Cerveja Artesanal', price: 6, description: 'Pressão 50cl - IPA da Casa', img: 'https://picsum.photos/seed/beer/300/300', stock: 100, taxConfig: TAX_IVA_14 },
    { id: 'c4', name: 'Caipirinha', price: 8, description: 'Cachaça, lima e açúcar', img: 'https://picsum.photos/seed/cocktail-1/300/300', stock: 40, taxConfig: TAX_IVA_14 },
  ],
  Comida: [
    { id: 'f1', name: 'Hambúrguer Gourmet', price: 18, description: 'Carne angus, queijo cheddar e bacon', img: 'https://picsum.photos/seed/burger/300/300', stock: 30, taxConfig: TAX_IVA_14 },
    { id: 'f2', name: 'Salada Tropical', price: 14, description: 'Mix de folhas, manga e molho especial', img: 'https://picsum.photos/seed/salad/300/300', stock: 20, taxConfig: TAX_IVA_14 },
    { id: 'f3', name: 'Tábua de Queijos', price: 22, description: 'Seleção de queijos nacionais e importados', img: 'https://picsum.photos/seed/cheese/300/300', stock: 15, taxConfig: TAX_IVA_14 },
  ],
  Sobremesas: [
    { id: 'd1', name: 'Pudim de Leite', price: 6, description: 'Caseiro com calda de caramelo', img: 'https://picsum.photos/seed/pudding/300/300', stock: 25, taxConfig: TAX_IVA_14 },
    { id: 'd2', name: 'Mousse de Chocolate', price: 7, description: 'Chocolate belga 70% cacau', img: 'https://picsum.photos/seed/chocolate/300/300', stock: 20, taxConfig: TAX_IVA_14 },
  ],
  Cocktails: [
    { id: 'ck1', name: 'Mojito', price: 9, description: 'Rum, hortelã, lima e soda', img: 'https://picsum.photos/seed/cocktail-2/300/300', stock: 45, taxConfig: TAX_IVA_14 },
    { id: 'ck2', name: 'Margarita', price: 10, description: 'Tequila, triple sec e sumo de lima', img: 'https://picsum.photos/seed/cocktail-3/300/300', stock: 35, taxConfig: TAX_IVA_14 },
    { id: 'ck3', name: 'Pina Colada', price: 11, description: 'Rum, coco e sumo de ananás', img: 'https://picsum.photos/seed/cocktail-4/300/300', stock: 30, taxConfig: TAX_IVA_14 },
  ],
};
