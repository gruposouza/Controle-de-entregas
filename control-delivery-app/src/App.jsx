/*
  NOTA IMPORTANTE SOBRE O ERRO "node: executable file not found in $PATH":
  Este erro indica que o ambiente que está tentando compilar ou executar este código React
  não consegue encontrar o Node.js. O Node.js é fundamental para muitas ferramentas de desenvolvimento React.
  Este código é um componente React e espera ser executado em um ambiente que possa processar JSX.
*/
//import { useState } from 'react'
//import reactLogo from './assets/react.svg'
//import viteLogo from '/vite.svg'
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LogOut, Edit3, PlusCircle, Save, Trash2, Truck, Building, DollarSign, Calendar, MapPin, Phone, ListChecks, BarChart2, Download, Fuel, Settings, AlertTriangle, Briefcase, Filter, XCircle, Droplet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Sector } from 'recharts';

// --- Configurações e Helpers do IndexedDB ---
const DB_NAME = 'DeliveryAppDB_v2'; // Nova versão para evitar conflitos com schema antigo, se houver
const DB_VERSION = 1; 
const STORES = {
    COMPANIES: 'companies',
    DAILY_ENTRIES: 'dailyEntries',
    COSTS: 'costs',
    REFUELS: 'refuels',
    SETTINGS: 'settings' // Um único store para todas as configurações
};

let dbPromise = null;

function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            console.error("IndexedDB não é suportado neste navegador.");
            reject(new Error("IndexedDB não suportado."));
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("Erro ao abrir IndexedDB:", event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            console.log("IndexedDB aberto com sucesso.");
            resolve(event.target.result);
        };

        request.onupgradeneeded = (event) => {
            console.log("Atualizando schema do IndexedDB...");
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORES.COMPANIES)) {
                db.createObjectStore(STORES.COMPANIES, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORES.DAILY_ENTRIES)) {
                const entryStore = db.createObjectStore(STORES.DAILY_ENTRIES, { keyPath: 'id' });
                entryStore.createIndex('date', 'date', { unique: false });
            }
            if (!db.objectStoreNames.contains(STORES.COSTS)) {
                const costStore = db.createObjectStore(STORES.COSTS, { keyPath: 'id' });
                costStore.createIndex('date', 'date', { unique: false });
            }
            if (!db.objectStoreNames.contains(STORES.REFUELS)) {
                const refuelStore = db.createObjectStore(STORES.REFUELS, { keyPath: 'id' });
                refuelStore.createIndex('date', 'date', { unique: false });
            }
            if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
                // Usaremos 'key' como keyPath para armazenar diferentes tipos de configurações.
                // Ex: { key: 'vehicleSettings', value: { averageEfficiency: 10, lastFuelPrice: 5.50 } }
                db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
            }
            console.log("Schema do IndexedDB atualizado.");
        };
    });
    return dbPromise;
}

async function getAllItems(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = (event) => {
            console.error(`Erro ao buscar todos os itens de ${storeName}:`, event.target.error);
            reject(event.target.error);
        };
    });
}

async function addItem(storeName, item) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(item);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => {
            console.error(`Erro ao adicionar item em ${storeName}:`, event.target.error);
            reject(event.target.error);
        };
    });
}

async function updateItem(storeName, item) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(item); // put atualiza ou insere se não existir
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => {
            console.error(`Erro ao atualizar item em ${storeName}:`, event.target.error);
            reject(event.target.error);
        };
    });
}

async function deleteItemById(storeName, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = (event) => {
            console.error(`Erro ao deletar item ${id} de ${storeName}:`, event.target.error);
            reject(event.target.error);
        };
    });
}

async function getSetting(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.SETTINGS, 'readonly');
        const store = transaction.objectStore(STORES.SETTINGS);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result ? request.result.value : null); // Retorna o campo 'value' do objeto
        request.onerror = (event) => {
            console.error(`Erro ao buscar configuração ${key}:`, event.target.error);
            reject(event.target.error);
        };
    });
}

async function saveSetting(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.SETTINGS, 'readwrite');
        const store = transaction.objectStore(STORES.SETTINGS);
        const request = store.put({ key, value }); // Salva um objeto com 'key' e 'value'
        request.onsuccess = () => resolve();
        request.onerror = (event) => {
            console.error(`Erro ao salvar configuração ${key}:`, event.target.error);
            reject(event.target.error);
        };
    });
}
// --- FIM: Configurações e Helpers do IndexedDB ---


// --- Funções Utilitárias de Data ---
const formatDateForInput = (date) => {
    if (!date) return '';
    if (date instanceof Date) return date.toISOString().split('T')[0];
    if (typeof date === 'string') return date.split('T')[0]; 
    return String(date).split('T')[0]; 
};

const parseDateFromInput = (dateString) => {
    if (!dateString) return null;
    return new Date(dateString + "T00:00:00Z"); 
};

const formatDisplayDate = (dateField) => {
    if (typeof dateField === 'string') { 
        const parsed = parseDateFromInput(dateField); 
        return parsed ? parsed.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Data inválida';
    }
    if (dateField instanceof Date) { 
         return dateField.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    }
    return 'Data inválida';
};


// --- Componentes Auxiliares ---
const Modal = ({ isOpen, onClose, children, title, size = "max-w-md" }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className={`bg-white p-6 rounded-lg shadow-xl w-full ${size} transform transition-all max-h-[90vh] overflow-y-auto`}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-700">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                </div>
                {children}
            </div>
        </div>
    );
};

const LoadingSpinner = ({ message = "Carregando..." }) => (
    <div className="flex items-center justify-center">
        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-indigo-500 mr-2"></div>
        <span className="text-sm text-gray-700">{message}</span>
    </div>
);

const FullPageLoading = ({ message = "Carregando aplicativo..."}) => (
     <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
         <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-500"></div>
         <p className="mt-4 text-lg text-gray-600">{message}</p>
     </div>
);

// --- Seções do Aplicativo ---

const CompanySection = ({ companies, loadCompanies }) => { 
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentCompany, setCurrentCompany] = useState({ name: '', address: '', contact: '' });
    const [editingCompanyId, setEditingCompanyId] = useState(null);
    const [error, setError] = useState('');
    const [localSuccessMessage, setLocalSuccessMessage] = useState('');
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
    const [itemToDeleteId, setItemToDeleteId] = useState(null);

    const handleOpenModal = (company = null) => {
        setError('');
        setLocalSuccessMessage('');
        if (company) {
            setCurrentCompany({ name: company.name, address: company.address || '', contact: company.contact || '' });
            setEditingCompanyId(company.id);
        } else {
            setCurrentCompany({ name: '', address: '', contact: '' });
            setEditingCompanyId(null);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentCompany({ name: '', address: '', contact: '' });
        setEditingCompanyId(null);
        setError('');
    };

    const handleSaveCompany = async () => {
        if (!currentCompany.name.trim()) {
            setError("O nome da empresa é obrigatório.");
            return;
        }
        
        try {
            if (editingCompanyId) {
                await updateItem(STORES.COMPANIES, { ...currentCompany, id: editingCompanyId });
                setLocalSuccessMessage("Empresa atualizada com sucesso!");
            } else {
                const newCompany = { ...currentCompany, id: crypto.randomUUID() };
                await addItem(STORES.COMPANIES, newCompany);
                setLocalSuccessMessage("Empresa adicionada com sucesso!");
            }
            loadCompanies(); 
            handleCloseModal();
            setTimeout(() => setLocalSuccessMessage(''), 3000);
        } catch (e) {
            setError("Falha ao salvar empresa.");
        }
    };
    
    const openDeleteConfirmModal = (companyId) => {
        setItemToDeleteId(companyId);
        setShowConfirmDeleteModal(true);
    };

    const handleDeleteCompany = async () => {
        if (!itemToDeleteId) return;
        try {
            await deleteItemById(STORES.COMPANIES, itemToDeleteId);
            setLocalSuccessMessage("Empresa excluída com sucesso!");
            loadCompanies(); 
        } catch (e) {
            setError("Falha ao excluir empresa.");
        } finally {
            setShowConfirmDeleteModal(false);
            setItemToDeleteId(null);
            setTimeout(() => setLocalSuccessMessage(''), 3000);
        }
    };
    
    return (
        <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold text-indigo-600 flex items-center"><Briefcase size={28} className="mr-2" />Gerenciar Empresas</h2>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm flex items-center transition-colors duration-150"
                >
                    <PlusCircle size={20} className="mr-2" /> Adicionar Empresa
                </button>
            </div>

            {error && <p className="text-red-500 bg-red-100 p-3 rounded-md mb-4 text-sm">{error}</p>}
            {localSuccessMessage && <p className="text-green-500 bg-green-100 p-3 rounded-md mb-4 text-sm">{localSuccessMessage}</p>}
            
            <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-4 mb-4 rounded-md" role="alert">
                <div className="flex">
                    <div className="py-1"><AlertTriangle className="h-6 w-6 text-yellow-500 mr-3" /></div>
                    <div>
                        <p className="font-bold">Atenção:</p>
                        <p className="text-sm">Excluir uma empresa <strong className="underline">não</strong> removerá automaticamente os registros diários ou de custos associados a ela nesta versão.</p>
                    </div>
                </div>
            </div>


            {companies.length === 0 && !error && (
                <p className="text-gray-500">Nenhuma empresa cadastrada ainda. Adicione uma para começar!</p>
            )}

            <div className="space-y-4">
                {companies.map(company => (
                    <div key={company.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50 hover:shadow-lg transition-shadow">
                        <h3 className="text-xl font-semibold text-gray-800">{company.name}</h3>
                        <p className="text-sm text-gray-600 flex items-center"><MapPin size={14} className="mr-1 text-gray-500" /> {company.address || "Endereço não informado"}</p>
                        <p className="text-sm text-gray-600 flex items-center"><Phone size={14} className="mr-1 text-gray-500" /> {company.contact || "Contato não informado"}</p>
                        <div className="mt-3 flex space-x-2">
                            <button
                                onClick={() => handleOpenModal(company)}
                                className="bg-yellow-400 hover:bg-yellow-500 text-white font-medium py-1 px-3 rounded-md text-sm flex items-center transition-colors duration-150"
                            >
                                <Edit3 size={16} className="mr-1" /> Editar
                            </button>
                            <button
                                onClick={() => openDeleteConfirmModal(company.id)}
                                className="bg-red-500 hover:bg-red-600 text-white font-medium py-1 px-3 rounded-md text-sm flex items-center transition-colors duration-150"
                            >
                                <Trash2 size={16} className="mr-1" /> Excluir
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingCompanyId ? "Editar Empresa" : "Adicionar Nova Empresa"}>
                {error && <p className="text-red-500 bg-red-100 p-2 rounded-md mb-3 text-sm">{error}</p>}
                <div className="space-y-4">
                    <div>
                        <label htmlFor="companyNameModal" className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa</label>
                        <input
                            type="text"
                            id="companyNameModal"
                            value={currentCompany.name}
                            onChange={(e) => setCurrentCompany({ ...currentCompany, name: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Ex: Loggi, Total Express"
                        />
                    </div>
                    <div>
                        <label htmlFor="companyAddressModal" className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                        <input
                            type="text"
                            id="companyAddressModal"
                            value={currentCompany.address}
                            onChange={(e) => setCurrentCompany({ ...currentCompany, address: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Ex: Rua das Entregas, 123, Centro"
                        />
                    </div>
                    <div>
                        <label htmlFor="companyContactModal" className="block text-sm font-medium text-gray-700 mb-1">Contato (Telefone/Email)</label>
                        <input
                            type="text"
                            id="companyContactModal"
                            value={currentCompany.contact}
                            onChange={(e) => setCurrentCompany({ ...currentCompany, contact: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Ex: (11) 99999-8888 ou contato@empresa.com"
                        />
                    </div>
                    <div className="flex justify-end space-x-3">
                        <button
                            onClick={handleCloseModal}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300 transition-colors duration-150"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSaveCompany}
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm flex items-center transition-colors duration-150"
                        >
                           <Save size={16} className="mr-2"/> {editingCompanyId ? "Salvar Alterações" : "Adicionar Empresa"}
                        </button>
                    </div>
                </div>
            </Modal>
            
            <Modal isOpen={showConfirmDeleteModal} onClose={() => setShowConfirmDeleteModal(false)} title="Confirmar Exclusão">
                <p className="text-gray-700 mb-4">Tem certeza que deseja excluir esta empresa? Lembre-se que os registros associados não serão excluídos automaticamente.</p>
                <div className="flex justify-end space-x-3">
                    <button
                        onClick={() => setShowConfirmDeleteModal(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleDeleteCompany}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm"
                    >
                        Excluir Empresa
                    </button>
                </div>
            </Modal>
        </div>
    );
};


const DailyEntrySection = ({ dailyEntries, loadDailyEntries, companies, vehicleSettings }) => { 
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentEntry, setCurrentEntry] = useState({
        date: formatDateForInput(new Date()),
        companyId: '', dailyRate: '', numDeliveries: '', defaultDeliveryValue: '',
        totalDeliveryValueOverride: '', initialMileage: '', finalMileage: '',
    });
    const [editingEntryId, setEditingEntryId] = useState(null);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
    const [itemToDeleteId, setItemToDeleteId] = useState(null);
    
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [filterCompanyId, setFilterCompanyId] = useState('');

    const [kmRodadosModal, setKmRodadosModal] = useState(0);
    const [estimatedFuelCostModal, setEstimatedFuelCostModal] = useState(0);

    useEffect(() => {
        const initialKm = parseFloat(currentEntry.initialMileage) || 0;
        const finalKm = parseFloat(currentEntry.finalMileage) || 0;
        let drivenKm = 0;

        if (finalKm > initialKm) {
            drivenKm = finalKm - initialKm;
        }
        setKmRodadosModal(drivenKm);

        if (drivenKm > 0 && vehicleSettings?.averageEfficiency > 0 && vehicleSettings?.lastFuelPrice > 0) {
            const cost = (drivenKm / vehicleSettings.averageEfficiency) * vehicleSettings.lastFuelPrice;
            setEstimatedFuelCostModal(cost);
        } else {
            setEstimatedFuelCostModal(0);
        }
    }, [currentEntry.initialMileage, currentEntry.finalMileage, vehicleSettings]);


    const filteredAndSortedEntries = useMemo(() => {
        let filtered = [...dailyEntries]; 

        if (filterDateStart) {
            const startDate = parseDateFromInput(filterDateStart);
            if (startDate) {
                filtered = filtered.filter(entry => {
                    const entryDate = parseDateFromInput(entry.date); 
                    return entryDate && entryDate >= startDate;
                });
            }
        }
        if (filterDateEnd) {
            const endDate = parseDateFromInput(filterDateEnd);
            if (endDate) {
                const inclusiveEndDate = new Date(endDate.getTime());
                inclusiveEndDate.setDate(inclusiveEndDate.getDate() + 1);

                filtered = filtered.filter(entry => {
                    const entryDate = parseDateFromInput(entry.date);
                    return entryDate && entryDate < inclusiveEndDate;
                });
            }
        }
        if (filterCompanyId) {
            filtered = filtered.filter(entry => entry.companyId === filterCompanyId);
        }

        return filtered.sort((a, b) => {
            const dateA = parseDateFromInput(a.date);
            const dateB = parseDateFromInput(b.date);
            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return dateB - dateA;
        });
    }, [dailyEntries, filterDateStart, filterDateEnd, filterCompanyId]);


    const handleOpenModal = (entry = null) => {
        setError(''); setSuccessMessage('');
        if (entry) {
            setCurrentEntry({
                date: formatDateForInput(entry.date), 
                companyId: entry.companyId, 
                dailyRate: entry.dailyRate || '', 
                numDeliveries: entry.numDeliveries || '',
                defaultDeliveryValue: entry.defaultDeliveryValue || '', 
                totalDeliveryValueOverride: entry.totalDeliveryValueOverride || '',
                initialMileage: entry.initialMileage || '', 
                finalMileage: entry.finalMileage || '',
            });
            setEditingEntryId(entry.id);
        } else {
            setCurrentEntry({
                date: formatDateForInput(new Date()), 
                companyId: companies.length > 0 ? companies[0].id : '',
                dailyRate: '', numDeliveries: '', defaultDeliveryValue: '', totalDeliveryValueOverride: '',
                initialMileage: '', finalMileage: '',
            });
            setEditingEntryId(null);
        }
        setKmRodadosModal(0);
        setEstimatedFuelCostModal(0);
        setIsModalOpen(true);
    };
    
    const handleCloseModal = () => { setIsModalOpen(false); setEditingEntryId(null); setError('');};

    const validateEntry = () => {
        if (!currentEntry.date || !currentEntry.companyId) { setError("Data e Empresa são obrigatórios."); return false; }
        const finalMileage = parseFloat(currentEntry.finalMileage);
        const initialMileage = parseFloat(currentEntry.initialMileage);
        if (finalMileage < initialMileage && currentEntry.finalMileage !== '' && currentEntry.initialMileage !== '') {
            setError("Quilometragem final não pode ser menor que a inicial."); return false;
        }
        setError(''); 
        return true;
    };

    const handleSaveEntry = async () => {
        if (!validateEntry()) return;
        
        const selectedCompany = companies.find(c => c.id === currentEntry.companyId);
        
        const entryDataToSave = {
            ...currentEntry, 
            companyName: selectedCompany ? selectedCompany.name : 'N/A',
            dailyRate: parseFloat(currentEntry.dailyRate) || 0,
            numDeliveries: parseInt(currentEntry.numDeliveries) || 0,
            defaultDeliveryValue: parseFloat(currentEntry.defaultDeliveryValue) || 0,
            totalDeliveryValueOverride: currentEntry.totalDeliveryValueOverride ? parseFloat(currentEntry.totalDeliveryValueOverride) : null,
            initialMileage: parseFloat(currentEntry.initialMileage) || 0,
            finalMileage: parseFloat(currentEntry.finalMileage) || 0,
            mileageDriven: kmRodadosModal, 
            estimatedFuelCost: estimatedFuelCostModal, 
        };

        let deliveryEarnings = 0;
        if (entryDataToSave.totalDeliveryValueOverride !== null && !isNaN(entryDataToSave.totalDeliveryValueOverride)) {
            deliveryEarnings = entryDataToSave.totalDeliveryValueOverride;
        } else {
            deliveryEarnings = (entryDataToSave.numDeliveries || 0) * (entryDataToSave.defaultDeliveryValue || 0);
        }
        entryDataToSave.totalEarnedToday = (entryDataToSave.dailyRate || 0) + deliveryEarnings;
        
        try {
            if (editingEntryId) {
                await updateItem(STORES.DAILY_ENTRIES, {...entryDataToSave, id: editingEntryId});
                setSuccessMessage("Entrada atualizada com sucesso!");
            } else {
                const newEntry = {...entryDataToSave, id: crypto.randomUUID()};
                await addItem(STORES.DAILY_ENTRIES, newEntry);
                setSuccessMessage("Entrada adicionada com sucesso!");
            }
            loadDailyEntries(); 
            handleCloseModal();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (e) { 
            setError("Falha ao salvar entrada.");
        }
    };
    
    const openDeleteConfirmModal = (entryId) => {
        setItemToDeleteId(entryId);
        setShowConfirmDeleteModal(true);
    };

    const handleDeleteEntry = async () => {
        if (!itemToDeleteId) return;
        try {
            await deleteItemById(STORES.DAILY_ENTRIES, itemToDeleteId);
            setSuccessMessage("Entrada excluída com sucesso!");
            loadDailyEntries(); 
        } catch (e) { 
            setError("Falha ao excluir entrada.");
        } finally {
            setShowConfirmDeleteModal(false);
            setItemToDeleteId(null);
            setTimeout(() => setSuccessMessage(''), 3000);
        }
    };

    const getCompanyName = (companyId) => companies.find(c => c.id === companyId)?.name || 'Empresa Desconhecida';

    const exportToCSV = () => {
        if (filteredAndSortedEntries.length === 0) { setError("Não há dados (com os filtros atuais) para exportar."); setTimeout(() => setError(''), 3000); return; }
        const headers = ["Data", "Empresa", "Diária (R$)", "Nº Entregas", "Valor Padrão Entrega (R$)", "Valor Total Entregas (R$)", "KM Inicial", "KM Final", "KM Rodados", "Custo Combustível Estimado (R$)", "Total Ganho Dia (R$)"];
        const rows = filteredAndSortedEntries.map(entry => {
            const companyName = getCompanyName(entry.companyId);
            const deliveryTotal = (entry.totalDeliveryValueOverride !== null && entry.totalDeliveryValueOverride !== undefined) ? entry.totalDeliveryValueOverride : ((entry.numDeliveries || 0) * (entry.defaultDeliveryValue || 0));
            const kmDriven = entry.mileageDriven || 0;
            const estimatedFuel = entry.estimatedFuelCost || 0;
            return [
                formatDisplayDate(entry.date), companyName, (entry.dailyRate || 0).toFixed(2), entry.numDeliveries || 0,
                (entry.defaultDeliveryValue || 0).toFixed(2), deliveryTotal.toFixed(2), entry.initialMileage || 0, entry.finalMileage || 0,
                kmDriven.toFixed(1), estimatedFuel.toFixed(2), (entry.totalEarnedToday || 0).toFixed(2)
            ].join(',');
        });
        const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n"); 
        const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `registros_diarios_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        setSuccessMessage("Dados exportados para CSV com sucesso!"); setTimeout(() => setSuccessMessage(''), 3000);
    };

    const clearFilters = () => {
        setFilterDateStart('');
        setFilterDateEnd('');
        setFilterCompanyId('');
    };
    
    return (
        <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
            <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                <h2 className="text-2xl font-semibold text-teal-600 flex items-center"><ListChecks size={28} className="mr-2" />Registros Diários</h2>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={exportToCSV} disabled={filteredAndSortedEntries.length === 0} className={`font-semibold py-2 px-4 rounded-lg shadow-sm flex items-center transition-colors duration-150 ${filteredAndSortedEntries.length === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}>
                        <Download size={20} className="mr-2" /> Exportar CSV
                    </button>
                    <button onClick={() => handleOpenModal()} disabled={companies.length === 0} className={`font-semibold py-2 px-4 rounded-lg shadow-sm flex items-center transition-colors duration-150 ${companies.length === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-teal-500 hover:bg-teal-600 text-white'}`}>
                        <PlusCircle size={20} className="mr-2" /> Adicionar Registro
                    </button>
                </div>
            </div>

            <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center"><Filter size={20} className="mr-2 text-gray-600"/>Filtros</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="filterDateStartDaily" className="block text-sm font-medium text-gray-700">Data Inicial:</label>
                        <input type="date" id="filterDateStartDaily" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"/>
                    </div>
                    <div>
                        <label htmlFor="filterDateEndDaily" className="block text-sm font-medium text-gray-700">Data Final:</label>
                        <input type="date" id="filterDateEndDaily" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"/>
                    </div>
                    <div>
                        <label htmlFor="filterCompanyDaily" className="block text-sm font-medium text-gray-700">Empresa:</label>
                        <select id="filterCompanyDaily" value={filterCompanyId} onChange={e => setFilterCompanyId(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm bg-white">
                            <option value="">Todas as Empresas</option>
                            {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
                        </select>
                    </div>
                </div>
                {(filterDateStart || filterDateEnd || filterCompanyId) && (
                     <button onClick={clearFilters} className="mt-4 text-sm text-indigo-600 hover:text-indigo-800 flex items-center">
                        <XCircle size={16} className="mr-1"/> Limpar Filtros
                    </button>
                )}
            </div>


            {companies.length === 0 && (<p className="text-orange-600 bg-orange-100 p-3 rounded-md mb-4 text-sm">Por favor, cadastre pelo menos uma empresa antes de adicionar registros diários.</p>)}
            {error && <p className="text-red-500 bg-red-100 p-3 rounded-md mb-4 text-sm">{error}</p>}
            {successMessage && <p className="text-green-500 bg-green-100 p-3 rounded-md mb-4 text-sm">{successMessage}</p>}
            
            {dailyEntries.length === 0 && !error && companies.length > 0 && ( 
                <p className="text-gray-500">Nenhum registro diário encontrado.</p>
            )}
            {filteredAndSortedEntries.length === 0 && dailyEntries.length > 0 && !error && (
                 <p className="text-gray-500">Nenhum registro diário encontrado para os filtros selecionados.</p>
            )}


            <div className="space-y-4">
                {filteredAndSortedEntries.map(entry => (
                    <div key={entry.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50 hover:shadow-lg transition-shadow">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800">{formatDisplayDate(entry.date)} - <span className="text-teal-600">{getCompanyName(entry.companyId)}</span></h3>
                                <p className="text-sm text-gray-600">Diária: R$ {(entry.dailyRate || 0).toFixed(2)}</p>
                                <p className="text-sm text-gray-600">Entregas: {entry.numDeliveries || 0} (Valor Total: R$ {((entry.totalDeliveryValueOverride !== null && entry.totalDeliveryValueOverride !== undefined) ? entry.totalDeliveryValueOverride : ((entry.numDeliveries || 0) * (entry.defaultDeliveryValue || 0))).toFixed(2)})</p>
                                <p className="text-sm text-gray-600">KM Rodados: {(entry.mileageDriven || 0).toFixed(1)}</p>
                                { (entry.estimatedFuelCost > 0) && <p className="text-sm text-orange-600">Custo Comb. Estimado: R$ {(entry.estimatedFuelCost || 0).toFixed(2)}</p> }
                                <p className="text-md font-bold text-green-600">Total Ganho: R$ {(entry.totalEarnedToday || 0).toFixed(2)}</p>
                            </div>
                            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mt-2 sm:mt-0">
                                <button onClick={() => handleOpenModal(entry)} className="bg-yellow-400 hover:bg-yellow-500 text-white font-medium py-1 px-3 rounded-md text-sm flex items-center"><Edit3 size={16} className="mr-1" /> Editar</button>
                                <button onClick={() => openDeleteConfirmModal(entry.id)} className="bg-red-500 hover:bg-red-600 text-white font-medium py-1 px-3 rounded-md text-sm flex items-center"><Trash2 size={16} className="mr-1" /> Excluir</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingEntryId ? "Editar Registro Diário" : "Adicionar Novo Registro Diário"} size="max-w-xl">
                {error && <p className="text-red-500 bg-red-100 p-2 rounded-md mb-3 text-sm">{error}</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                        <label htmlFor="entryDateModal" className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                        <input type="date" id="entryDateModal" name="date" value={currentEntry.date} onChange={(e) => setCurrentEntry({ ...currentEntry, date: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md shadow-sm"/>
                    </div>
                    <div>
                        <label htmlFor="entryCompanyModal" className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
                        <select id="entryCompanyModal" name="companyId" value={currentEntry.companyId} onChange={(e) => setCurrentEntry({ ...currentEntry, companyId: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md shadow-sm bg-white">
                            <option value="">Selecione uma empresa</option>
                            {companies.map(company => (<option key={company.id} value={company.id}>{company.name}</option>))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="dailyRateModal" className="block text-sm font-medium text-gray-700 mb-1">Valor da Diária (R$)</label>
                        <input type="number" step="0.01" name="dailyRate" id="dailyRateModal" value={currentEntry.dailyRate} onChange={(e) => setCurrentEntry({ ...currentEntry, dailyRate: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Ex: 100.00"/>
                    </div>
                    <div>
                        <label htmlFor="numDeliveriesModal" className="block text-sm font-medium text-gray-700 mb-1">Nº de Entregas</label>
                        <input type="number" id="numDeliveriesModal" name="numDeliveries" value={currentEntry.numDeliveries} onChange={(e) => setCurrentEntry({ ...currentEntry, numDeliveries: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Ex: 15"/>
                    </div>
                    <div>
                        <label htmlFor="defaultDeliveryValueModal" className="block text-sm font-medium text-gray-700 mb-1">Valor Padrão por Entrega (R$)</label>
                        <input type="number" step="0.01" id="defaultDeliveryValueModal" name="defaultDeliveryValue" value={currentEntry.defaultDeliveryValue} onChange={(e) => setCurrentEntry({ ...currentEntry, defaultDeliveryValue: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Ex: 5.50"/>
                    </div>
                    <div>
                        <label htmlFor="totalDeliveryValueOverrideModal" className="block text-sm font-medium text-gray-700 mb-1">Valor Total Entregas (R$) <span className="text-xs text-gray-500">(Opcional)</span></label>
                        <input type="number" step="0.01" id="totalDeliveryValueOverrideModal" name="totalDeliveryValueOverride" value={currentEntry.totalDeliveryValueOverride} onChange={(e) => setCurrentEntry({ ...currentEntry, totalDeliveryValueOverride: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Cálculo padrão se vazio"/>
                        <p className="text-xs text-gray-500 mt-1">Preencha se diferente de (Nº Entregas * Valor Padrão).</p>
                    </div>
                    <div>
                        <label htmlFor="initialMileageModal" className="block text-sm font-medium text-gray-700 mb-1">KM Inicial</label>
                        <input type="number" step="0.1" id="initialMileageModal" name="initialMileage" value={currentEntry.initialMileage} onChange={(e) => setCurrentEntry({ ...currentEntry, initialMileage: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Ex: 15000.0"/>
                    </div>
                    <div>
                        <label htmlFor="finalMileageModal" className="block text-sm font-medium text-gray-700 mb-1">KM Final</label>
                        <input type="number" step="0.1" id="finalMileageModal" name="finalMileage" value={currentEntry.finalMileage} onChange={(e) => setCurrentEntry({ ...currentEntry, finalMileage: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Ex: 15120.5"/>
                    </div>
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 mt-2 pt-2 border-t border-gray-200">
                        <div>
                            <label className="block text-sm font-medium text-gray-500">KM Rodados (Calculado)</label>
                            <p className="mt-1 p-2 bg-gray-100 rounded-md text-gray-700 font-semibold">{kmRodadosModal.toFixed(1)} km</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-500">Custo Combustível Estimado (R$)</label>
                            <p className={`mt-1 p-2 bg-gray-100 rounded-md font-semibold ${estimatedFuelCostModal > 0 ? 'text-orange-600' : 'text-gray-700'}`}>
                                {vehicleSettings?.averageEfficiency && vehicleSettings?.lastFuelPrice ? estimatedFuelCostModal.toFixed(2) : <span className="text-xs text-gray-400">Configure o veículo</span>}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                    <button onClick={handleCloseModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300">Cancelar</button>
                    <button onClick={handleSaveEntry} className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md shadow-sm flex items-center"><Save size={16} className="mr-2" /> {editingEntryId ? "Salvar Alterações" : "Adicionar"}</button>
                </div>
            </Modal>
            <Modal isOpen={showConfirmDeleteModal} onClose={() => setShowConfirmDeleteModal(false)} title="Confirmar Exclusão">
                <p className="text-gray-700 mb-4">Tem certeza que deseja excluir este registro diário?</p>
                <div className="flex justify-end space-x-3">
                    <button onClick={() => setShowConfirmDeleteModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300">Cancelar</button>
                    <button onClick={handleDeleteEntry} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm">Excluir Registro</button>
                </div>
            </Modal>
        </div>
    );
};

const CostsSection = ({ costs, loadCosts }) => { 
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentCost, setCurrentCost] = useState({ date: formatDateForInput(new Date()), description: '', amount: '', category: 'Outros' });
    const [editingCostId, setEditingCostId] = useState(null);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
    const [itemToDeleteId, setItemToDeleteId] = useState(null);
    
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [filterCategory, setFilterCategory] = useState('');


    const costCategories = ["Combustível", "Manutenção", "Alimentação", "Pedágio", "MEI/Impostos", "Acessórios/Ferramentas", "Multas", "Outros"];

    const filteredAndSortedCosts = useMemo(() => {
        let filtered = [...costs]; 
        if (filterDateStart) {
            const startDate = parseDateFromInput(filterDateStart);
            if(startDate) {
                filtered = filtered.filter(cost => {
                    const costDate = parseDateFromInput(cost.date);
                    return costDate && costDate >= startDate;
                });
            }
        }
        if (filterDateEnd) {
            const endDate = parseDateFromInput(filterDateEnd);
            if(endDate) {
                const inclusiveEndDate = new Date(endDate.getTime());
                inclusiveEndDate.setDate(inclusiveEndDate.getDate() + 1);
                filtered = filtered.filter(cost => {
                    const costDate = parseDateFromInput(cost.date);
                    return costDate && costDate < inclusiveEndDate;
                });
            }
        }
        if (filterCategory) {
            filtered = filtered.filter(cost => cost.category === filterCategory);
        }
        return filtered.sort((a, b) => {
            const dateA = parseDateFromInput(a.date);
            const dateB = parseDateFromInput(b.date);
            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return dateB - dateA;
        });
    }, [costs, filterDateStart, filterDateEnd, filterCategory]);


    const handleOpenModal = (cost = null) => {
        setError(''); setSuccessMessage('');
        if (cost) {
            setCurrentCost({
                date: formatDateForInput(cost.date),
                description: cost.description, amount: cost.amount, category: cost.category,
            });
            setEditingCostId(cost.id);
        } else {
            setCurrentCost({ date: formatDateForInput(new Date()), description: '', amount: '', category: 'Outros' });
            setEditingCostId(null);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => { setIsModalOpen(false); setEditingCostId(null); setError(''); };

    const validateCost = () => {
        if (!currentCost.date || !currentCost.description.trim() || !currentCost.amount || !currentCost.category) { setError("Data, Descrição, Valor e Categoria são obrigatórios."); return false; }
        if (parseFloat(currentCost.amount) <= 0) { setError("O valor do custo deve ser maior que zero."); return false; }
        setError('');
        return true;
    };

    const handleSaveCost = async () => {
        if (!validateCost()) return;
        
        const costDataToSave = { 
            ...currentCost, 
            amount: parseFloat(currentCost.amount) 
        };
        
        try {
            if (editingCostId) {
                await updateItem(STORES.COSTS, {...costDataToSave, id: editingCostId});
                setSuccessMessage("Custo atualizado com sucesso!");
            } else {
                const newCost = {...costDataToSave, id: crypto.randomUUID()};
                await addItem(STORES.COSTS, newCost);
                setSuccessMessage("Custo adicionado com sucesso!");
            }
            loadCosts(); 
            handleCloseModal(); 
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (e) {
            setError("Falha ao salvar custo.");
        }
    };
    
    const openDeleteConfirmModal = (costId) => {
        setItemToDeleteId(costId);
        setShowConfirmDeleteModal(true);
    };
    
    const handleDeleteCost = async () => {
        if (!itemToDeleteId) return;
        try {
            await deleteItemById(STORES.COSTS, itemToDeleteId);
            setSuccessMessage("Custo excluído com sucesso!"); 
            loadCosts(); 
        } catch (e) {
             setError("Falha ao excluir custo.");
        } finally {
            setShowConfirmDeleteModal(false);
            setItemToDeleteId(null);
            setTimeout(() => setSuccessMessage(''), 3000);
        }
    };
    
    const getCategoryIcon = (category) => {
        switch(category) {
            case "Combustível": return <Fuel size={16} className="mr-1 text-orange-500"/>;
            case "Manutenção": return <Settings size={16} className="mr-1 text-blue-500"/>;
            case "Alimentação": return <DollarSign size={16} className="mr-1 text-yellow-500"/>; 
            case "Pedágio": return <Truck size={16} className="mr-1 text-cyan-500"/>; 
            case "MEI/Impostos": return <Briefcase size={16} className="mr-1 text-purple-500"/>;
            case "Acessórios/Ferramentas": return <PlusCircle size={16} className="mr-1 text-lime-500"/>;
            case "Multas": return <AlertTriangle size={16} className="mr-1 text-red-700"/>;
            default: return <DollarSign size={16} className="mr-1 text-gray-500"/>;
        }
    };

    const clearFilters = () => {
        setFilterDateStart('');
        setFilterDateEnd('');
        setFilterCategory('');
    };

    // JSX da CostsSection permanece o mesmo, usando filteredAndSortedCosts
    return (
        <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold text-red-600 flex items-center"><DollarSign size={28} className="mr-2" />Gerenciar Custos</h2>
                <button onClick={() => handleOpenModal()} className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm flex items-center"><PlusCircle size={20} className="mr-2" /> Adicionar Custo</button>
            </div>

            <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center"><Filter size={20} className="mr-2 text-gray-600"/>Filtros de Custos</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="filterDateStartCosts" className="block text-sm font-medium text-gray-700">Data Inicial:</label>
                        <input type="date" id="filterDateStartCosts" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"/>
                    </div>
                    <div>
                        <label htmlFor="filterDateEndCosts" className="block text-sm font-medium text-gray-700">Data Final:</label>
                        <input type="date" id="filterDateEndCosts" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"/>
                    </div>
                    <div>
                        <label htmlFor="filterCategoryCosts" className="block text-sm font-medium text-gray-700">Categoria:</label>
                        <select id="filterCategoryCosts" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm bg-white">
                            <option value="">Todas as Categorias</option>
                            {costCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                </div>
                 {(filterDateStart || filterDateEnd || filterCategory) && (
                     <button onClick={clearFilters} className="mt-4 text-sm text-indigo-600 hover:text-indigo-800 flex items-center">
                        <XCircle size={16} className="mr-1"/> Limpar Filtros
                    </button>
                )}
            </div>


            {error && <p className="text-red-500 bg-red-100 p-3 rounded-md mb-4 text-sm">{error}</p>}
            {successMessage && <p className="text-green-500 bg-green-100 p-3 rounded-md mb-4 text-sm">{successMessage}</p>}
            
            {costs.length === 0 && !error && (
                <p className="text-gray-500">Nenhum custo registrado ainda.</p>
            )}
            {filteredAndSortedCosts.length === 0 && costs.length > 0 && !error && (
                 <p className="text-gray-500">Nenhum custo encontrado para os filtros selecionados.</p>
            )}


            <div className="space-y-4">
                {filteredAndSortedCosts.map(cost => (
                    <div key={cost.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50 hover:shadow-lg">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 flex items-center">{getCategoryIcon(cost.category)}{cost.description} - <span className="text-red-600">R$ {(cost.amount || 0).toFixed(2)}</span></h3>
                                <p className="text-sm text-gray-600">Data: {formatDisplayDate(cost.date)}</p>
                                <p className="text-sm text-gray-600">Categoria: {cost.category}</p>
                            </div>
                            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mt-2 sm:mt-0">
                                <button onClick={() => handleOpenModal(cost)} className="bg-yellow-400 hover:bg-yellow-500 text-white font-medium py-1 px-3 rounded-md text-sm flex items-center"><Edit3 size={16} className="mr-1" /> Editar</button>
                                <button onClick={() => openDeleteConfirmModal(cost.id)} className="bg-red-500 hover:bg-red-600 text-white font-medium py-1 px-3 rounded-md text-sm flex items-center"><Trash2 size={16} className="mr-1" /> Excluir</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingCostId ? "Editar Custo" : "Adicionar Custo"}>
                {error && <p className="text-red-500 bg-red-100 p-2 rounded-md mb-3 text-sm">{error}</p>}
                <div className="space-y-4">
                    <div><label htmlFor="costDateModal" className="block text-sm font-medium text-gray-700 mb-1">Data</label><input type="date" id="costDateModal" value={currentCost.date} onChange={(e) => setCurrentCost({ ...currentCost, date: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md shadow-sm"/></div>
                    <div><label htmlFor="costDescriptionModal" className="block text-sm font-medium text-gray-700 mb-1">Descrição</label><input type="text" id="costDescriptionModal" value={currentCost.description} onChange={(e) => setCurrentCost({ ...currentCost, description: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Ex: Almoço, Troca de óleo"/></div>
                    <div><label htmlFor="costAmountModal" className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label><input type="number" step="0.01" id="costAmountModal" value={currentCost.amount} onChange={(e) => setCurrentCost({ ...currentCost, amount: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Ex: 25.50"/></div>
                    <div><label htmlFor="costCategoryModal" className="block text-sm font-medium text-gray-700 mb-1">Categoria</label><select id="costCategoryModal" value={currentCost.category} onChange={(e) => setCurrentCost({ ...currentCost, category: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md shadow-sm bg-white">{costCategories.map(cat => (<option key={cat} value={cat}>{cat}</option>))}</select></div>
                    <div className="flex justify-end space-x-3 mt-6"><button onClick={handleCloseModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border">Cancelar</button><button onClick={handleSaveCost} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm flex items-center"><Save size={16} className="mr-2"/> {editingCostId ? "Salvar" : "Adicionar"}</button></div>
                </div>
            </Modal>
            <Modal isOpen={showConfirmDeleteModal} onClose={() => setShowConfirmDeleteModal(false)} title="Confirmar Exclusão">
                <p className="text-gray-700 mb-4">Tem certeza que deseja excluir este custo?</p>
                <div className="flex justify-end space-x-3">
                    <button onClick={() => setShowConfirmDeleteModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border">Cancelar</button>
                    <button onClick={handleDeleteCost} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm">Excluir Custo</button>
                </div>
            </Modal>
        </div>
    );
};

const PIE_CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#a4de6c', '#d0ed57', '#ffc658'];

const ActiveShapePieChart = (props) => {
  const RADIAN = Math.PI / 180;
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 10) * cos;
  const sy = cy + (outerRadius + 10) * sin;
  const mx = cx + (outerRadius + 30) * cos;
  const my = cy + (outerRadius + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} className="font-semibold text-lg">
        {payload.name}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 6}
        outerRadius={outerRadius + 10}
        fill={fill}
      />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#333">{`R$ ${value.toFixed(2)}`}</text>
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#999">
        {`(${(percent * 100).toFixed(2)}%)`}
      </text>
    </g>
  );
};


const MonthlyReportSection = ({ entries, companies, costs }) => { 
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [reportData, setReportData] = useState(null);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [activePieIndex, setActivePieIndex] = useState(0);

    const onPieEnter = useCallback((_, index) => {
        setActivePieIndex(index);
    }, [setActivePieIndex]);


    const calculateReport = useCallback(() => {
        setError('');
        setIsLoading(true);
        const [year, month] = selectedMonth.split('-').map(Number);

        const filterByMonthAndYear = (item) => {
            const itemDate = parseDateFromInput(item.date); 
            return itemDate && itemDate.getUTCFullYear() === year && (itemDate.getUTCMonth() + 1) === month;
        };

        const filteredEntries = entries.filter(filterByMonthAndYear);
        const filteredCosts = costs.filter(filterByMonthAndYear);
        
        const summaryByCompany = {};
        let totalGeralGanhos = 0, totalKmGeral = 0, totalEstimatedFuelCostFromEntries = 0;
        const workedDays = new Set();

        filteredEntries.forEach(entry => {
            const companyId = entry.companyId;
            if (!summaryByCompany[companyId]) {
                summaryByCompany[companyId] = { name: entry.companyName || companies.find(c => c.id === companyId)?.name || 'Desconhecida', totalEarned: 0, totalDeliveries: 0, totalKm: 0, daysWorked: 0 };
            }
            summaryByCompany[companyId].totalEarned += entry.totalEarnedToday || 0;
            summaryByCompany[companyId].totalDeliveries += entry.numDeliveries || 0;
            summaryByCompany[companyId].totalKm += entry.mileageDriven || 0;
            summaryByCompany[companyId].daysWorked += 1; 
            totalGeralGanhos += entry.totalEarnedToday || 0;
            totalKmGeral += entry.mileageDriven || 0;
            totalEstimatedFuelCostFromEntries += entry.estimatedFuelCost || 0; 
            const entryDateString = formatDateForInput(entry.date);
            workedDays.add(entryDateString);
        });
        
        const totalDiasTrabalhados = workedDays.size;
        const totalGeralCustosManuais = filteredCosts.reduce((acc, cost) => acc + (cost.amount || 0), 0);
        const totalGeralCustos = totalGeralCustosManuais; 
        const lucroLiquido = totalGeralGanhos - totalGeralCustos;


        const costsByCategory = filteredCosts.reduce((acc, cost) => {
            const category = cost.category || 'Outros';
            acc[category] = (acc[category] || 0) + (cost.amount || 0);
            return acc;
        }, {});
        
        const pieChartData = Object.entries(costsByCategory)
            .map(([name, value]) => ({ name, value }))
            .sort((a,b) => b.value - a.value); 

        setReportData({
            byCompany: Object.values(summaryByCompany), totalGeralGanhos, totalKmGeral, totalDiasTrabalhados,
            totalGeralCustos, lucroLiquido, pieChartData, totalEstimatedFuelCostFromEntries,
            month: new Date(year, month - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
        });
        setIsLoading(false);
    }, [entries, selectedMonth, companies, costs]); 

    useEffect(() => { calculateReport(); }, [calculateReport]);

    const handleMonthChange = (event) => { setSelectedMonth(event.target.value); };

    const barChartData = reportData ? [
        { name: 'Ganhos', valor: reportData.totalGeralGanhos, fill: '#82ca9d' },
        { name: 'Custos (Manuais)', valor: reportData.totalGeralCustos, fill: '#ff8042' }, 
        { name: 'Lucro', valor: reportData.lucroLiquido, fill: '#8884d8' },
    ] : [];


    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-purple-600 mb-4 flex items-center"><BarChart2 size={28} className="mr-2" />Relatório Mensal</h2>
            {error && <p className="text-red-500 bg-red-100 p-3 rounded-md mb-4 text-sm">{error}</p>}
            <div className="mb-4">
                <label htmlFor="monthSelectorReport" className="block text-sm font-medium text-gray-700 mb-1">Selecione o Mês:</label>
                <input type="month" id="monthSelectorReport" value={selectedMonth} onChange={handleMonthChange} className="w-full md:w-auto p-2 border border-gray-300 rounded-md shadow-sm bg-white"/>
            </div>
            {isLoading ? <LoadingSpinner message="Calculando relatório..." /> : reportData && reportData.month ? (
                <div>
                    <h3 className="text-xl font-medium text-gray-700 mb-3">Resumo de {reportData.month}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                        <div className="p-4 bg-green-100 rounded-lg"><p className="text-sm text-green-700">Ganhos Brutos</p><p className="text-2xl font-bold text-green-800">R$ {reportData.totalGeralGanhos.toFixed(2)}</p></div>
                        <div className="p-4 bg-red-100 rounded-lg"><p className="text-sm text-red-700">Total Custos (Manuais)</p><p className="text-2xl font-bold text-red-800">R$ {reportData.totalGeralCustos.toFixed(2)}</p></div>
                        <div className="p-4 bg-purple-100 rounded-lg"><p className="text-sm text-purple-700">Lucro Líquido</p><p className="text-2xl font-bold text-purple-800">R$ {reportData.lucroLiquido.toFixed(2)}</p></div>
                        <div className="p-4 bg-blue-100 rounded-lg"><p className="text-sm text-blue-700">KM Rodados</p><p className="text-2xl font-bold text-blue-800">{reportData.totalKmGeral.toFixed(1)} km</p></div>
                        <div className="p-4 bg-teal-100 rounded-lg"><p className="text-sm text-teal-700">Dias Trabalhados</p><p className="text-2xl font-bold text-teal-800">{reportData.totalDiasTrabalhados} dias</p></div>
                         {reportData.totalDiasTrabalhados > 0 && (
                            <div className="p-4 bg-indigo-100 rounded-lg"><p className="text-sm text-indigo-700">Média Ganhos/Dia</p><p className="text-2xl font-bold text-indigo-800">R$ {(reportData.totalGeralGanhos / reportData.totalDiasTrabalhados).toFixed(2)}</p></div>
                         )}
                         {reportData.totalEstimatedFuelCostFromEntries > 0 && (
                             <div className="p-4 bg-orange-100 rounded-lg col-span-1 md:col-span-2 lg:col-span-1"><p className="text-sm text-orange-700">Custo Estimado Combustível (Diárias)</p><p className="text-2xl font-bold text-orange-800">R$ {reportData.totalEstimatedFuelCostFromEntries.toFixed(2)}</p></div>
                         )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 my-8">
                        <div>
                            <h4 className="text-lg font-medium text-gray-700 mb-2 text-center">Visão Geral Financeira</h4>
                            {barChartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={barChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis tickFormatter={(value) => `R$${value.toLocaleString('pt-BR')}`} />
                                        <Tooltip formatter={(value) => `R$${Number(value).toFixed(2).toLocaleString('pt-BR')}`} />
                                        <Legend />
                                        <Bar dataKey="valor" name="Valor" />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <p className="text-center text-gray-500">Sem dados para o gráfico de visão geral.</p>}
                        </div>
                        <div>
                            <h4 className="text-lg font-medium text-gray-700 mb-2 text-center">Distribuição de Custos (Manuais) por Categoria</h4>
                            {reportData.pieChartData && reportData.pieChartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            activeIndex={activePieIndex}
                                            activeShape={ActiveShapePieChart}
                                            data={reportData.pieChartData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            fill="#8884d8"
                                            dataKey="value"
                                            onMouseEnter={onPieEnter}
                                        >
                                            {reportData.pieChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => `R$${Number(value).toFixed(2).toLocaleString('pt-BR')}`} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : <p className="text-center text-gray-500">Sem dados de custos para o gráfico de pizza.</p>}
                        </div>
                    </div>


                    <h4 className="text-lg font-medium text-gray-700 mb-2">Detalhes por Empresa (Ganhos):</h4>
                    {reportData.byCompany.length > 0 ? (
                        <div className="space-y-3">{reportData.byCompany.map(compData => (<div key={compData.name} className="p-3 border rounded-lg bg-gray-50"><h5 className="font-semibold text-purple-700">{compData.name}</h5><p className="text-sm">Ganhos: R$ {compData.totalEarned.toFixed(2)} | Entregas: {compData.totalDeliveries} | KM: {compData.totalKm.toFixed(1)} | Dias: {compData.daysWorked}</p></div>))}</div>
                    ) : (<p className="text-gray-500">Nenhum ganho registrado para este mês.</p>)}
                </div>
            ) : (<p className="text-gray-500">Nenhum dado para o mês selecionado ou carregando...</p>)}
        </div>
    );
};

const VehicleSettingsModal = ({ isOpen, onClose, currentSettings, onSave }) => {
    const [averageEfficiency, setAverageEfficiency] = useState('');
    const [lastFuelPrice, setLastFuelPrice] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (currentSettings) {
            setAverageEfficiency(currentSettings.averageEfficiency || '');
            setLastFuelPrice(currentSettings.lastFuelPrice || '');
        } else { 
            setAverageEfficiency('');
            setLastFuelPrice('');
        }
    }, [currentSettings]);

    const handleSaveSettings = async () => {
        setError('');
        setSuccess('');
        
        const efficiency = parseFloat(averageEfficiency);
        const price = parseFloat(lastFuelPrice);

        if (isNaN(efficiency) || efficiency <= 0) {
            setError("Consumo médio inválido. Deve ser um número maior que zero.");
            return;
        }
        if (isNaN(price) || price <= 0) {
            setError("Preço do combustível inválido. Deve ser um número maior que zero.");
            return;
        }

        const settingsToSave = {
            averageEfficiency: efficiency,
            lastFuelPrice: price,
        };

        try {
            await onSave(settingsToSave); 
            setSuccess("Configurações salvas com sucesso!");
            setTimeout(() => {
                setSuccess('');
                onClose();
            }, 1500);
        } catch (e) {
            console.error("Erro ao salvar configurações do veículo:", e);
            setError("Falha ao salvar configurações. Tente novamente.");
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Configurações do Veículo">
            {error && <p className="text-red-500 bg-red-100 p-2 rounded-md mb-3 text-sm">{error}</p>}
            {success && <p className="text-green-500 bg-green-100 p-2 rounded-md mb-3 text-sm">{success}</p>}
            <div className="space-y-4">
                <div>
                    <label htmlFor="avgEfficiency" className="block text-sm font-medium text-gray-700">Consumo Médio (km/L)</label>
                    <input 
                        type="number" 
                        step="0.1" 
                        id="avgEfficiency" 
                        value={averageEfficiency} 
                        onChange={e => setAverageEfficiency(e.target.value)}
                        className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm"
                        placeholder="Ex: 10.5"
                    />
                </div>
                <div>
                    <label htmlFor="lastFuelPrice" className="block text-sm font-medium text-gray-700">Último Preço Combustível (R$/L)</label>
                    <input 
                        type="number" 
                        step="0.01" 
                        id="lastFuelPrice" 
                        value={lastFuelPrice} 
                        onChange={e => setLastFuelPrice(e.target.value)}
                        className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm"
                        placeholder="Ex: 5.89"
                    />
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border">Cancelar</button>
                    <button onClick={handleSaveSettings} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm flex items-center"><Save size={16} className="mr-2"/> Salvar Configurações</button>
                </div>
            </div>
        </Modal>
    );
};


const RefuelSection = ({ vehicleSettings, onUpdateVehicleSettings, refuels, loadRefuels }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentRefuel, setCurrentRefuel] = useState({
        date: formatDateForInput(new Date()),
        odometer: '',
        litersFilled: '',
        pricePerLiter: vehicleSettings?.lastFuelPrice || '',
        totalCost: '',
        kmSinceLastRefuel: '', 
    });
    const [editingRefuelId, setEditingRefuelId] = useState(null);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
    const [itemToDeleteId, setItemToDeleteId] = useState(null);

    useEffect(() => { 
        if (vehicleSettings?.lastFuelPrice && !currentRefuel.pricePerLiter && !editingRefuelId) { 
            setCurrentRefuel(prev => ({...prev, pricePerLiter: vehicleSettings.lastFuelPrice}));
        }
    }, [vehicleSettings, currentRefuel.pricePerLiter, editingRefuelId]);


    const handleOpenModal = (refuel = null) => {
        setError(''); setSuccessMessage('');
        if (refuel) {
            setCurrentRefuel({
                date: formatDateForInput(refuel.date),
                odometer: refuel.odometer || '',
                litersFilled: refuel.litersFilled || '',
                pricePerLiter: refuel.pricePerLiter || vehicleSettings?.lastFuelPrice || '',
                totalCost: refuel.totalCost || '',
                kmSinceLastRefuel: refuel.kmSinceLastRefuel || '',
            });
            setEditingRefuelId(refuel.id);
        } else {
            setCurrentRefuel({
                date: formatDateForInput(new Date()),
                odometer: '', litersFilled: '', 
                pricePerLiter: vehicleSettings?.lastFuelPrice || '', 
                totalCost: '', kmSinceLastRefuel: '',
            });
            setEditingRefuelId(null);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => { setIsModalOpen(false); setEditingRefuelId(null); setError('');};

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        const newRefuelData = { ...currentRefuel, [name]: value };

        if (name === "litersFilled" || name === "pricePerLiter") {
            const liters = parseFloat(newRefuelData.litersFilled);
            const price = parseFloat(newRefuelData.pricePerLiter);
            if (!isNaN(liters) && !isNaN(price) && liters > 0 && price > 0) {
                newRefuelData.totalCost = (liters * price).toFixed(2);
            } else {
                newRefuelData.totalCost = ''; 
            }
        }
        setCurrentRefuel(newRefuelData);
    };


    const handleSaveRefuel = async () => {
        setError('');
        const { date, odometer, litersFilled, pricePerLiter, totalCost, kmSinceLastRefuel } = currentRefuel;
        if(!date || !odometer || !litersFilled || !pricePerLiter) {
            setError("Data, Odômetro, Litros e Preço/Litro são obrigatórios.");
            return;
        }
        const odo = parseFloat(odometer);
        const liters = parseFloat(litersFilled);
        const price = parseFloat(pricePerLiter);
        const kmDriven = parseFloat(kmSinceLastRefuel) || 0;

        if(isNaN(odo) || odo <=0) { setError("Odômetro inválido."); return; }
        if(isNaN(liters) || liters <=0) { setError("Litros inválido."); return; }
        if(isNaN(price) || price <=0) { setError("Preço/Litro inválido."); return; }
        if(kmSinceLastRefuel && (isNaN(kmDriven) || kmDriven < 0)) {setError("KM Rodados inválido."); return;}


        let calculatedKmL = null;
        if (kmDriven > 0 && liters > 0) {
            calculatedKmL = kmDriven / liters;
        }
        
        const refuelData = {
            date: date, 
            odometer: odo,
            litersFilled: liters,
            pricePerLiter: price,
            totalCost: parseFloat(totalCost) || (liters * price), 
            kmSinceLastRefuel: kmDriven > 0 ? kmDriven : null,
            calculatedKmL: calculatedKmL ? parseFloat(calculatedKmL.toFixed(2)) : null,
        };

        try {
            if (editingRefuelId) {
                await updateItem(STORES.REFUELS, {...refuelData, id: editingRefuelId});
                setSuccessMessage("Abastecimento atualizado!");
            } else {
                const newRefuel = {...refuelData, id: crypto.randomUUID()};
                await addItem(STORES.REFUELS, newRefuel);
                setSuccessMessage("Abastecimento adicionado!");
            }
            
            if (price !== vehicleSettings?.lastFuelPrice) {
                 onUpdateVehicleSettings({ ...vehicleSettings, lastFuelPrice: price, averageEfficiency: vehicleSettings?.averageEfficiency || null });
                 setSuccessMessage(prev => prev + " Preço do combustível atualizado nas configurações.");
            }
            loadRefuels(); 
            handleCloseModal();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (e) {
            setError("Falha ao salvar abastecimento.");
        }
    };
    
    const openDeleteConfirmModal = (id) => { setItemToDeleteId(id); setShowConfirmDeleteModal(true); };
    const handleDeleteRefuel = async () => {
        if(!itemToDeleteId) return;
        try {
            await deleteItemById(STORES.REFUELS, itemToDeleteId);
            setSuccessMessage("Abastecimento excluído.");
            loadRefuels(); 
        } catch(e) {
            setError("Falha ao excluir.");
        } finally {
            setShowConfirmDeleteModal(false);
            setItemToDeleteId(null);
            setTimeout(() => setSuccessMessage(''), 3000);
        }
    };

    const overallAverageKmL = useMemo(() => {
        const validRefuels = refuels.filter(r => r.calculatedKmL && r.calculatedKmL > 0);
        if (validRefuels.length === 0) return null;
        const totalKm = validRefuels.reduce((sum, r) => sum + (r.kmSinceLastRefuel || 0), 0);
        const totalLiters = validRefuels.reduce((sum, r) => sum + (r.litersFilled || 0), 0);
        return totalLiters > 0 ? (totalKm / totalLiters) : null;
    }, [refuels]);

    const handleUseAverageKmL = () => {
        if (overallAverageKmL && overallAverageKmL > 0) {
            onUpdateVehicleSettings({ 
                ...vehicleSettings, 
                averageEfficiency: parseFloat(overallAverageKmL.toFixed(2)) 
            });
            setSuccessMessage("Consumo médio atualizado nas configurações!");
            setTimeout(() => setSuccessMessage(''), 3000);
        } else {
            setError("Nenhuma média válida calculada para usar.");
            setTimeout(() => setError(''), 3000);
        }
    };

    // JSX da RefuelSection permanece o mesmo
    return (
        <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
            <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                <h2 className="text-2xl font-semibold text-cyan-600 flex items-center"><Fuel size={28} className="mr-2" />Registros de Abastecimento</h2>
                <button onClick={() => handleOpenModal()} className="bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm flex items-center">
                    <PlusCircle size={20} className="mr-2" /> Adicionar Abastecimento
                </button>
            </div>
            {error && <p className="text-red-500 bg-red-100 p-3 rounded-md mb-4 text-sm">{error}</p>}
            {successMessage && <p className="text-green-500 bg-green-100 p-3 rounded-md mb-4 text-sm">{successMessage}</p>}

            {overallAverageKmL && (
                <div className="my-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-center">
                    <p className="text-blue-700">Consumo Médio Calculado (todos os registros válidos): <strong className="text-xl">{overallAverageKmL.toFixed(2)} km/L</strong></p>
                    <button 
                        onClick={handleUseAverageKmL}
                        className="mt-2 bg-blue-500 hover:bg-blue-600 text-white text-sm py-1 px-3 rounded-md"
                    >
                        Usar esta média como Consumo Padrão
                    </button>
                </div>
            )}

            {refuels.length === 0 && !error && (<p className="text-gray-500">Nenhum abastecimento registrado.</p>)}
            <div className="space-y-4">
                {refuels.map(refuel => (
                    <div key={refuel.id} className="p-4 border rounded-lg bg-gray-50 hover:shadow-lg">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800">{formatDisplayDate(refuel.date)}</h3>
                                <p className="text-sm text-gray-600">Odômetro: {refuel.odometer} km</p>
                                <p className="text-sm text-gray-600">Litros: {refuel.litersFilled} L</p>
                                <p className="text-sm text-gray-600">Preço/L: R$ {refuel.pricePerLiter.toFixed(2)}</p>
                                <p className="text-sm text-gray-600">Custo Total: R$ {refuel.totalCost.toFixed(2)}</p>
                                {refuel.kmSinceLastRefuel && <p className="text-sm text-gray-600">KM Rodados (neste tanque): {refuel.kmSinceLastRefuel} km</p>}
                                {refuel.calculatedKmL && <p className="text-sm font-semibold text-cyan-700">Consumo (neste tanque): {refuel.calculatedKmL.toFixed(2)} km/L</p>}
                            </div>
                             <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mt-2 sm:mt-0">
                                <button onClick={() => handleOpenModal(refuel)} className="bg-yellow-400 hover:bg-yellow-500 text-white font-medium py-1 px-3 rounded-md text-sm flex items-center"><Edit3 size={16} className="mr-1" /> Editar</button>
                                <button onClick={() => openDeleteConfirmModal(refuel.id)} className="bg-red-500 hover:bg-red-600 text-white font-medium py-1 px-3 rounded-md text-sm flex items-center"><Trash2 size={16} className="mr-1" /> Excluir</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingRefuelId ? "Editar Abastecimento" : "Adicionar Abastecimento"} size="max-w-lg">
                 {error && <p className="text-red-500 bg-red-100 p-2 rounded-md mb-3 text-sm">{error}</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700">Data</label><input type="date" name="date" value={currentRefuel.date} onChange={handleInputChange} className="mt-1 w-full p-2 border rounded-md"/></div>
                    <div><label className="block text-sm font-medium text-gray-700">Odômetro (km)</label><input type="number" name="odometer" value={currentRefuel.odometer} onChange={handleInputChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Ex: 12345"/></div>
                    <div><label className="block text-sm font-medium text-gray-700">Litros Abastecidos (L)</label><input type="number" step="0.01" name="litersFilled" value={currentRefuel.litersFilled} onChange={handleInputChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Ex: 40.5"/></div>
                    <div><label className="block text-sm font-medium text-gray-700">Preço por Litro (R$)</label><input type="number" step="0.001" name="pricePerLiter" value={currentRefuel.pricePerLiter} onChange={handleInputChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Ex: 5.899"/></div>
                    <div><label className="block text-sm font-medium text-gray-700">Custo Total (R$)</label><input type="number" step="0.01" name="totalCost" value={currentRefuel.totalCost} onChange={handleInputChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Automático ou manual"/></div>
                    <div><label className="block text-sm font-medium text-gray-700">KM Rodados neste Tanque <span className="text-xs">(Opcional)</span></label><input type="number" step="0.1" name="kmSinceLastRefuel" value={currentRefuel.kmSinceLastRefuel} onChange={handleInputChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Para calcular km/L"/></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Preencha "KM Rodados neste Tanque" para calcular o consumo (km/L) específico deste abastecimento.</p>
                <div className="flex justify-end space-x-3 mt-6">
                    <button onClick={handleCloseModal} className="px-4 py-2 text-sm rounded-md border">Cancelar</button>
                    <button onClick={handleSaveRefuel} className="px-4 py-2 text-sm text-white bg-cyan-600 hover:bg-cyan-700 rounded-md flex items-center"><Save size={16} className="mr-2"/> {editingRefuelId ? "Salvar" : "Adicionar"}</button>
                </div>
            </Modal>
             <Modal isOpen={showConfirmDeleteModal} onClose={() => setShowConfirmDeleteModal(false)} title="Confirmar Exclusão">
                <p className="text-gray-700 mb-4">Tem certeza que deseja excluir este registro de abastecimento?</p>
                <div className="flex justify-end space-x-3">
                    <button onClick={() => setShowConfirmDeleteModal(false)} className="px-4 py-2 text-sm rounded-md border">Cancelar</button>
                    <button onClick={handleDeleteRefuel} className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-md">Excluir</button>
                </div>
            </Modal>
        </div>
    );
};


// --- Componente Principal App ---
function App() {
    const [isAppReady, setIsAppReady] = useState(false); 
    
    const [companies, setCompanies] = useState([]);
    const [dailyEntries, setDailyEntries] = useState([]); 
    const [costs, setCosts] = useState([]);
    const [refuels, setRefuels] = useState([]); 
    const [vehicleSettings, setVehicleSettings] = useState({ averageEfficiency: 10, lastFuelPrice: 5.50 }); 
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    const [activeTab, setActiveTab] = useState('dailyEntry'); 
    const [appError, setAppError] = useState(null);

    const loadAllData = useCallback(async () => {
        setAppError(null);
        setIsAppReady(false); 
        try {
            await openDB(); 
            
            const [
                loadedCompanies, 
                loadedDailyEntries, 
                loadedCosts, 
                loadedRefuels, 
                storedSettings
            ] = await Promise.all([
                getAllItems(STORES.COMPANIES),
                getAllItems(STORES.DAILY_ENTRIES),
                getAllItems(STORES.COSTS),
                getAllItems(STORES.REFUELS),
                getSetting('vehicleSettings') 
            ]);

            setCompanies(loadedCompanies);
            setDailyEntries(loadedDailyEntries);
            setCosts(loadedCosts);
            setRefuels(loadedRefuels);

            if (storedSettings) {
                setVehicleSettings(storedSettings);
            } else {
                await saveSetting('vehicleSettings', { averageEfficiency: 10, lastFuelPrice: 5.50 });
                setVehicleSettings({ averageEfficiency: 10, lastFuelPrice: 5.50 });
            }
        } catch (e) {
            console.error("Erro ao carregar dados iniciais:", e);
            setAppError("Falha ao carregar dados do banco de dados local. Tente recarregar.");
        } finally {
            setIsAppReady(true);
        }
    }, []);

    useEffect(() => {
        loadAllData();
    }, [loadAllData]);


    const handleSaveVehicleSettings = async (newSettings) => {
        try {
            await saveSetting('vehicleSettings', newSettings); 
            setVehicleSettings(newSettings); 
        } catch (e) {
            console.error("Erro ao salvar configurações do veículo no IndexedDB:", e);
            setAppError("Falha ao salvar configurações do veículo.");
            throw new Error("Falha ao salvar configurações localmente."); 
        }
    };

    const handleLogout = () => {
        setCompanies([]);
        setDailyEntries([]);
        setCosts([]);
        setRefuels([]);
        setVehicleSettings({ averageEfficiency: 10, lastFuelPrice: 5.50 }); 
        setActiveTab('dailyEntry');
        setAppError(null);
        alert("Sessão local reiniciada. Os dados permanecem no IndexedDB do navegador, a menos que limpos manualmente ou por uma função de limpeza completa (descomentada no código).");
    };

    const TabButton = ({ tabName, currentTab, setTab, icon, label }) => {
        const IconComponent = icon;
        const isActive = currentTab === tabName;
        return (
            <button onClick={() => setTab(tabName)}
                className={`flex-1 sm:flex-none flex items-center justify-center sm:justify-start space-x-2 px-3 py-3 sm:px-4 sm:py-2 rounded-lg font-medium transition-all duration-150 ${isActive ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                <IconComponent size={20} /> <span className="hidden sm:inline">{label}</span>
            </button>
        );
    };

    if (!isAppReady) { 
        return <FullPageLoading message="Carregando aplicativo..." />;
    }
    
    if (appError && !isAppReady) { 
         return (
            <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
                <AlertTriangle size={48} className="text-red-500 mb-4" />
                <h1 className="text-2xl font-bold text-red-700 mb-2">Erro de Inicialização</h1>
                <p className="text-gray-700 mb-4 text-center whitespace-pre-line">{appError}</p>
                <p className="text-sm text-gray-500">Verifique se seu navegador suporta IndexedDB e se não há extensões bloqueando o armazenamento local.</p>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-gray-100 p-4 sm:p-6 md:p-8 font-sans">
            <header className="mb-6 bg-white shadow-md rounded-lg p-4">
                <div className="flex flex-col sm:flex-row justify-between items-center">
                    <div className="flex items-center text-indigo-700 mb-2 sm:mb-0">
                        <Truck size={36} className="mr-2" />
                        <h1 className="text-2xl sm:text-3xl font-bold">Controle de Entregas</h1>
                    </div>
                    <div className="flex items-center space-x-3">
                        <span className="text-sm text-gray-600 hidden md:inline">Armazenamento: IndexedDB</span>
                        <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 text-gray-600 hover:text-indigo-600" title="Configurações do Veículo">
                            <Settings size={20}/>
                        </button>
                        <button
                            onClick={handleLogout} 
                            className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-3 sm:px-4 rounded-lg shadow-sm flex items-center transition-colors text-sm sm:text-base"
                        >
                            <LogOut size={18} className="mr-1 sm:mr-2" /> Reiniciar Sessão Local
                        </button>
                    </div>
                </div>
            </header>

            {appError && <p className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md mb-4 text-sm whitespace-pre-line" role="alert"><strong className="font-bold">Aviso:</strong> {appError}</p>}

            <nav className="mb-6 sm:mb-8 bg-white p-2 rounded-lg shadow-md">
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                       <TabButton tabName="dailyEntry" currentTab={activeTab} setTab={setActiveTab} icon={ListChecks} label="Registros" />
                       <TabButton tabName="costs" currentTab={activeTab} setTab={setActiveTab} icon={DollarSign} label="Custos" />
                       <TabButton tabName="refuels" currentTab={activeTab} setTab={setActiveTab} icon={Fuel} label="Abastecimentos" />
                       <TabButton tabName="company" currentTab={activeTab} setTab={setActiveTab} icon={Briefcase} label="Empresas" />
                       <TabButton tabName="report" currentTab={activeTab} setTab={setActiveTab} icon={BarChart2} label="Relatório" />
                </div>
            </nav>
            
            <main>
                {activeTab === 'company' && <CompanySection companies={companies} loadCompanies={loadAllData} />}
                {activeTab === 'dailyEntry' && <DailyEntrySection dailyEntries={dailyEntries} loadDailyEntries={loadAllData} companies={companies} vehicleSettings={vehicleSettings} />}
                {activeTab === 'costs' && <CostsSection costs={costs} loadCosts={loadAllData} />}
                {activeTab === 'refuels' && <RefuelSection refuels={refuels} loadRefuels={loadAllData} vehicleSettings={vehicleSettings} onUpdateVehicleSettings={handleSaveVehicleSettings} />}
                {activeTab === 'report' && <MonthlyReportSection entries={dailyEntries} companies={companies} costs={costs} />}
            </main>

            <VehicleSettingsModal 
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                currentSettings={vehicleSettings}
                onSave={handleSaveVehicleSettings}
            />

            <footer className="mt-12 text-center text-sm text-gray-500">
                <p>&copy; {new Date().getFullYear()} App Controle de Entregas. Todos os direitos reservados.</p>
                 <p className="text-xs mt-1">Este aplicativo utiliza <strong className="text-indigo-600">IndexedDB</strong> do navegador para armazenamento de dados.</p>
            </footer>
        </div>
    );
}

export default App;
