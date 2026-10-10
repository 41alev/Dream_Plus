/**
 * Çok şirketlilik altyapı hazırlığı — tek, paylaşılan kaynak.
 *
 * Sistem bugün tek bir firma varsayımıyla çalışıyor. Bu modül, gelecekte
 * gerçek çoklu şirket desteği eklenmek istendiğinde tüm sorgu filtrelemesinin
 * TEK bir yerden geçmesini sağlamak için var. Şirket kimliği bugün webhook
 * ve muhasebe akışlarında kullanılıyor; bütün iş sorgularını kapsamıyor.
 * Desteklenen kurulum modeli her müşteri için ayrı veri dizini ve tek firmadır.
 * Bu yardımcı tek başına çoklu şirket veri izolasyonu sağlamaz.
 */
const DEFAULT_COMPANY_ID = 1;

/** @param {{ user?: { companyId?: number|string } }} req */
function companyIdOf(req) {
  return req.user?.companyId || DEFAULT_COMPANY_ID;
}

module.exports = { DEFAULT_COMPANY_ID, companyIdOf };
