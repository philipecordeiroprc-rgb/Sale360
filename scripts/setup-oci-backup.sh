#!/usr/bin/env bash
# ============================================================
# Sale360 — Configurar acesso OCI Object Storage para Backup
# ============================================================
set -euo pipefail

echo "🔧 Configurando acesso OCI Object Storage para backups..."
echo ""

# Tenancy e região (já conhecidos)
TENANCY_ID="ocid1.tenancy.oc1..aaaaaaaaixwylkxk7cred6wmktvwnyww5xau22bcxotquztinjjbufpdmn6q"
COMPARTMENT_ID="ocid1.compartment.oc1..aaaaaaaaqciwhblo5oy45dlwpq6nrwiacl2evom7byrvukewzm5mk7mlatpq"
REGION="sa-saopaulo-1"
NAMESPACE="grqxj1nvh4zj"
BUCKET="sale360-backups"

echo "Namespace: $NAMESPACE"
echo "Bucket:    $BUCKET"
echo "Região:    $REGION"
echo ""

# Verificar se bucket existe
echo "Verificando bucket..."
BUCKET_CHECK=$(oci os bucket get --auth instance_principal --bucket-name "$BUCKET" --region "$REGION" 2>&1) || true
if echo "$BUCKET_CHECK" | grep -q "BucketNotFound"; then
    echo "Bucket não encontrado. Criando..."
    oci os bucket create --auth instance_principal \
        --compartment-id "$COMPARTMENT_ID" \
        --name "$BUCKET" \
        --region "$REGION" \
        --storage-tier Standard 2>&1 || echo "Bucket pode já existir"
fi

# Testar upload
echo ""
echo "Testando upload..."
echo "test-$(date +%s)" > /tmp/oci-upload-test.txt
if oci os object put \
    --auth instance_principal \
    --bucket-name "$BUCKET" \
    --region "$REGION" \
    --file /tmp/oci-upload-test.txt \
    --name "setup-test.txt" \
    --force 2>&1; then
    echo ""
    echo "✅ OCI Object Storage configurado com sucesso!"
    echo "   Backup OCI funcionando."
    rm -f /tmp/oci-upload-test.txt
else
    echo ""
    echo "⚠️  Instance principal não tem permissão para acessar Object Storage."
    echo ""
    echo "Para corrigir, adicione esta política no OCI Console:"
    echo ""
    echo "  Identity → Policies → Criar Política"
    echo "  Compartment: <seu compartment>"
    echo "  Nome: sale360-backup-policy"
    echo ""
    echo "  Statements:"
    echo "    Allow dynamic-group InstanceDynamicGroup to manage objects"
    echo "      in compartment <seu-compartment>"
    echo "      where target.bucket.name = 'sale360-backups'"
    echo ""
    echo "OU configure uma chave API:"
    echo "  1. Gere a chave: openssl genrsa -out ~/.oci/oci_api_key.pem 2048"
    echo "  2. Gere a pública: openssl rsa -pubout -in ~/.oci/oci_api_key.pem -out ~/.oci/oci_api_key_public.pem"
    echo "  3. No OCI Console: Identity → Users → Seu Usuário → API Keys → Add"
    echo "  4. Cole o conteúdo de ~/.oci/oci_api_key_public.pem"
    echo "  5. Configure ~/.oci/config com user OCID, fingerprint, tenancy, region, key_file"
    echo "  6. Execute: oci os object put --bucket-name sale360-backups --file teste.txt"
fi

echo ""
echo "Script finalizado."
