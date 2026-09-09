import { format } from 'date-fns';

/**
 * Service to generate SAF-T (AO) files adapted to Angola.
 * Based on AGT (Administração Geral Tributária) requirements.
 */
export const SafTService = {
  /**
   * Generates a SAF-T XML file content.
   */
  generateXml: (data: {
    company: any,
    menu: any,
    bookings: any[],
    barOrders: any[],
    leisureEvents: any[],
    month: string // YYYY-MM
  }) => {
    const { company, menu, bookings, barOrders, leisureEvents, month } = data;
    const [year, monthNum] = month.split('-');
    
    // Header Info
    const softwareCertificateNumber = '000/AGT/2024'; // Mock certificate for demonstration
    const auditFileVersion = '1.01_01';
    
    // Process Products (Menu)
    const products = Object.entries(menu).flatMap(([cat, items]: [string, any]) => 
      items.map((item: any) => ({
        code: item.id,
        description: item.name,
        type: 'P', // P for Product, S for Service
        group: cat
      }))
    );
    
    // Process Customers (Unique DocumentIds from bookings)
    const customersMap = new Map();
    bookings.forEach(b => {
      if (b.documentId && !customersMap.has(b.documentId)) {
        customersMap.set(b.documentId, {
          id: b.documentId,
          name: b.name,
          nif: b.documentId.length === 9 ? b.documentId : '999999999', // Mock NIF logic
          address: 'Luanda, Angola' // Default for mock
        });
      }
    });
    
    const customers = Array.from(customersMap.values());
    
    // Build the XML String
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:AO:1.01_01">\n`;
    
    // 1. Header
    xml += `  <Header>\n`;
    xml += `    <AuditFileVersion>${auditFileVersion}</AuditFileVersion>\n`;
    xml += `    <CompanyID>${company.nif}</CompanyID>\n`;
    xml += `    <TaxRegistrationNumber>${company.nif}</TaxRegistrationNumber>\n`;
    xml += `    <TaxAccountingBasis>F</TaxAccountingBasis>\n`;
    xml += `    <CompanyName>${SafTService.escape(company.name)}</CompanyName>\n`;
    xml += `    <BusinessName>${SafTService.escape(company.name)}</BusinessName>\n`;
    xml += `    <CompanyAddress>\n`;
    xml += `      <AddressDetail>${SafTService.escape(company.address)}</AddressDetail>\n`;
    xml += `      <City>Luanda</City>\n`;
    xml += `      <Country>AO</Country>\n`;
    xml += `    </CompanyAddress>\n`;
    xml += `    <FiscalYear>${year}</FiscalYear>\n`;
    xml += `    <StartDate>${year}-${monthNum}-01</StartDate>\n`;
    xml += `    <EndDate>${year}-${monthNum}-31</EndDate>\n`; // Simplified
    xml += `    <CurrencyCode>AOA</CurrencyCode>\n`;
    xml += `    <DateCreated>${format(new Date(), 'yyyy-MM-dd')}</DateCreated>\n`;
    xml += `    <TaxEntity>Global</TaxEntity>\n`;
    xml += `    <ProductCompanyTaxID>${company.nif}</ProductCompanyTaxID>\n`;
    xml += `    <SoftwareCertificateNumber>${softwareCertificateNumber}</SoftwareCertificateNumber>\n`;
    xml += `    <ProductID>HotelGestPro/Arvex</ProductID>\n`;
    xml += `    <ProductVersion>2.0.0</ProductVersion>\n`;
    xml += `  </Header>\n`;
    
    // 2. MasterFiles
    xml += `  <MasterFiles>\n`;
    
    // 2.1 Customers
    if (customers.length > 0) {
      customers.forEach(c => {
        xml += `    <Customer>\n`;
        xml += `      <CustomerID>${c.id}</CustomerID>\n`;
        xml += `      <CustomerTaxID>${SafTService.escape(c.nif)}</CustomerTaxID>\n`;
        xml += `      <CompanyName>${SafTService.escape(c.name)}</CompanyName>\n`;
        xml += `      <BillingAddress>\n`;
        xml += `        <AddressDetail>${SafTService.escape(c.address)}</AddressDetail>\n`;
        xml += `        <City>Luanda</City>\n`;
        xml += `        <Country>AO</Country>\n`;
        xml += `      </BillingAddress>\n`;
        xml += `      <SelfBillingIndicator>0</SelfBillingIndicator>\n`;
        xml += `    </Customer>\n`;
      });
    }

    // 2.2 Products
    products.forEach(p => {
      xml += `    <Product>\n`;
      xml += `      <ProductType>${p.type}</ProductType>\n`;
      xml += `      <ProductCode>${p.code}</ProductCode>\n`;
      xml += `      <ProductGroup>${SafTService.escape(p.group)}</ProductGroup>\n`;
      xml += `      <ProductDescription>${SafTService.escape(p.description)}</ProductDescription>\n`;
      xml += `      <ProductNumberCode>${p.code}</ProductNumberCode>\n`;
      xml += `    </Product>\n`;
    });

    // 2.3 TaxTable
    const allInvoices = SafTService.mapInvoices(bookings, barOrders, leisureEvents, month);
    const uniqueTaxes = new Map<string, any>();
    allInvoices.forEach(inv => {
      inv.lines.forEach((line: any) => {
        if (line.taxConfig && !uniqueTaxes.has(line.taxConfig.code)) {
          uniqueTaxes.set(line.taxConfig.code, line.taxConfig);
        }
      });
    });

    // Default 14% if none found
    if (uniqueTaxes.size === 0) {
      uniqueTaxes.set('NOR', { type: 'IVA', rate: 14, code: 'NOR', description: 'Taxa Normal' });
    }

    xml += `    <TaxTable>\n`;
    uniqueTaxes.forEach(tax => {
      xml += `      <TaxTableEntry>\n`;
      xml += `        <TaxType>${tax.type}</TaxType>\n`;
      xml += `        <TaxCountryRegion>AO</TaxCountryRegion>\n`;
      xml += `        <TaxCode>${tax.code}</TaxCode>\n`;
      xml += `        <Description>${SafTService.escape(tax.description)}</Description>\n`;
      xml += `        <TaxPercentage>${tax.rate}</TaxPercentage>\n`;
      xml += `      </TaxTableEntry>\n`;
    });
    xml += `    </TaxTable>\n`;
    xml += `  </MasterFiles>\n`;
    
    // 3. SourceDocuments (Invoices)
    const totalLines = allInvoices.reduce((sum, inv) => sum + inv.lines.length, 0);
    const totalDebit = 0;
    const totalCredit = allInvoices.reduce((sum, inv) => sum + inv.total, 0);

    xml += `  <SourceDocuments>\n`;
    xml += `    <SalesInvoices>\n`;
    xml += `      <NumberOfEntries>${allInvoices.length}</NumberOfEntries>\n`;
    xml += `      <TotalDebit>${totalDebit.toFixed(2)}</TotalDebit>\n`;
    xml += `      <TotalCredit>${totalCredit.toFixed(2)}</TotalCredit>\n`;
      
    allInvoices.forEach(inv => {
      xml += `      <Invoice>\n`;
      xml += `        <InvoiceNo>${inv.no}</InvoiceNo>\n`;
      xml += `        <ATCUD>0</ATCUD>\n`;
      xml += `        <DocumentStatus>\n`;
      xml += `          <InvoiceStatus>${inv.status === 'voided' ? 'A' : 'N'}</InvoiceStatus>\n`;
      xml += `          <InvoiceStatusDate>${inv.date}</InvoiceStatusDate>\n`;
      xml += `          <SourceID>${inv.userId}</SourceID>\n`;
      xml += `          <SourceBilling>P</SourceBilling>\n`;
      xml += `        </DocumentStatus>\n`;
      xml += `        <Hash>${inv.hash || 'MOCK_HASH_' + inv.id}</Hash>\n`;
      xml += `        <HashControl>1</HashControl>\n`;
      xml += `        <Period>${monthNum}</Period>\n`;
      xml += `        <InvoiceDate>${inv.date.split('T')[0]}</InvoiceDate>\n`;
      xml += `        <InvoiceType>FT</InvoiceType>\n`;
      xml += `        <SelfBillingIndicator>0</SelfBillingIndicator>\n`;
      xml += `        <SystemEntryDate>${inv.date}</SystemEntryDate>\n`;
      xml += `        <CustomerID>${inv.customerId || '999999999'}</CustomerID>\n`;
      
      let invoiceNetTotal = 0;
      let invoiceTaxTotal = 0;

      inv.lines.forEach((line: any, idx: number) => {
        const rate = line.taxConfig?.rate || 14;
        const grossLineTotal = line.price * line.qty;
        const netLineTotal = grossLineTotal / (1 + rate / 100);
        const lineTax = grossLineTotal - netLineTotal;
        const netUnitPrice = line.price / (1 + rate / 100);
        
        invoiceNetTotal += netLineTotal;
        invoiceTaxTotal += lineTax;

        xml += `        <Line>\n`;
        xml += `          <LineNumber>${idx + 1}</LineNumber>\n`;
        xml += `          <ProductCode>${line.code}</ProductCode>\n`;
        xml += `          <ProductDescription>${SafTService.escape(line.description)}</ProductDescription>\n`;
        xml += `          <Quantity>${line.qty}</Quantity>\n`;
        xml += `          <UnitOfMeasure>unid.</UnitOfMeasure>\n`;
        xml += `          <UnitPrice>${netUnitPrice.toFixed(2)}</UnitPrice>\n`;
        xml += `          <TaxPointDate>${inv.date.split('T')[0]}</TaxPointDate>\n`;
        xml += `          <Description>${SafTService.escape(line.description)}</Description>\n`;
        xml += `          <CreditAmount>${netLineTotal.toFixed(2)}</CreditAmount>\n`;
        xml += `          <Tax>\n`;
        xml += `            <TaxType>${line.taxConfig?.type || 'IVA'}</TaxType>\n`;
        xml += `            <TaxCountryRegion>AO</TaxCountryRegion>\n`;
        xml += `            <TaxCode>${line.taxConfig?.code || 'NOR'}</TaxCode>\n`;
        xml += `            <TaxPercentage>${rate}</TaxPercentage>\n`;
        xml += `          </Tax>\n`;
        if (rate === 0 && line.taxConfig?.exemptionCode) {
          xml += `          <TaxExemptionCode>${line.taxConfig.exemptionCode}</TaxExemptionCode>\n`;
          xml += `          <TaxExemptionReason>${SafTService.escape(line.taxConfig.exemptionReason || '')}</TaxExemptionReason>\n`;
        }
        xml += `          <SettlementAmount>0.00</SettlementAmount>\n`;
        xml += `        </Line>\n`;
      });

      xml += `        <DocumentTotals>\n`;
      xml += `          <TaxPayable>${invoiceTaxTotal.toFixed(2)}</TaxPayable>\n`;
      xml += `          <NetTotal>${invoiceNetTotal.toFixed(2)}</NetTotal>\n`;
      xml += `          <GrossTotal>${(invoiceNetTotal + invoiceTaxTotal).toFixed(2)}</GrossTotal>\n`;
      xml += `        </DocumentTotals>\n`;
      xml += `      </Invoice>\n`;
    });

    xml += `    </SalesInvoices>\n`;
    xml += `  </SourceDocuments>\n`;
    xml += `</AuditFile>\n`;
    
    return xml;
  },

  mapInvoices: (bookings: any[], barOrders: any[], leisureEvents: any[], month: string) => {
    const all = [];
    const defaultTax = { type: 'IVA', rate: 14, code: 'NOR', description: 'Taxa Normal' };

    // Map Bookings safely
    (bookings || []).filter(b => {
      const dateStr = b?.in || b?.checkIn || b?.createdAt || '';
      return typeof dateStr === 'string' && dateStr.startsWith(month);
    }).forEach(b => {
      const dateStr = b?.in || b?.checkIn || b?.createdAt || new Date().toISOString();
      all.push({
        id: b.id || Math.random().toString(36).substring(2, 9),
        no: b.invoiceNumber || `FT BK/${b.id || '001'}`,
        date: dateStr,
        customerId: b.documentId || b.customerNif || b.nif || '999999999',
        userId: 'Admin',
        status: b.status === 'cancelled' ? 'voided' : 'normal',
        hash: b.signature || '',
        total: Number(b.totalAmount || b.totalPrice || 200),
        lines: [
          { 
            code: 'BK_ACCOM', 
            description: `Acomodação Quarto ${b.room || ''}`, 
            qty: 1, 
            price: Number(b.totalAmount || b.totalPrice || 200),
            taxConfig: b.taxConfig || defaultTax
          }
        ]
      });
    });

    // Map BarOrders safely
    (barOrders || []).filter(o => {
      const dateStr = o?.date || o?.createdAt || '';
      return typeof dateStr === 'string' && dateStr.startsWith(month);
    }).forEach(o => {
      const dateStr = o?.date || o?.createdAt || new Date().toISOString();
      let parsedItems: any[] = [];
      if (Array.isArray(o.items)) {
        parsedItems = o.items;
      } else if (typeof o.items === 'string') {
        try {
          parsedItems = JSON.parse(o.items);
        } catch {
          parsedItems = [];
        }
      }

      all.push({
        id: o.id || Math.random().toString(36).substring(2, 9),
        no: o.invoiceNumber || `FT BAR/${o.id || '001'}`,
        date: dateStr,
        customerId: o.documentId || '999999999',
        userId: 'Admin',
        status: o.status === 'voided' ? 'voided' : 'normal',
        hash: o.signature || '',
        total: Number(o.total || 0),
        lines: parsedItems.map((item: any) => ({
          code: (item.name || 'ITEM').replace(/\s+/g, '_'),
          description: item.name || 'Item de Bar',
          qty: Number(item.qty || 1),
          price: Number(item.price || 0),
          taxConfig: item.taxConfig || defaultTax
        }))
      });
    });

    // Map LeisureEvents safely
    (leisureEvents || []).filter(e => {
      const dateStr = e?.date || e?.createdAt || '';
      return typeof dateStr === 'string' && dateStr.startsWith(month);
    }).forEach(e => {
      const dateStr = e?.date || e?.createdAt || new Date().toISOString();
      all.push({
        id: e.id || Math.random().toString(36).substring(2, 9),
        no: e.invoiceNumber || `FT EV/${e.id || '001'}`,
        date: dateStr,
        customerId: e.documentId || '999999999',
        userId: 'Admin',
        status: e.status === 'Cancelado' || e.status === 'cancelled' ? 'voided' : 'normal',
        hash: e.signature || '',
        total: Number(e.price || e.paidAmount || 0),
        lines: [
          { 
            code: 'EV_SERVICE', 
            description: e.name || 'Serviço de Lazer', 
            qty: 1, 
            price: Number(e.price || e.paidAmount || 0),
            taxConfig: e.taxConfig || defaultTax
          }
        ]
      });
    });

    return all;
  },

  escape: (text: string) => {
    if (!text) return '';
    return text.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  },

  download: (xml: string, filename: string) => {
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};
