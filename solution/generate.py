#!/usr/bin/env python3
"""Generate the CodeApp101 unmanaged Dataverse solution package.

Schema of record for SPEC.md §2. Run:  python3 solution/generate.py
Emits solution/src/{solution.xml,customizations.xml,[Content_Types].xml}
and solution/CodeApp101_1_1_0_0.zip (import via make.powerapps.com → Solutions → Import).
"""
from __future__ import annotations
import pathlib, uuid, zipfile
from xml.sax.saxutils import escape

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE / "src"
VERSION = "1.1.0.0"
BASE_VERSION = "1.0.0.0"                   # columns and tables that shipped in the first release keep this
LANG = 1033
PREFIX = "cb"
SOLUTION_UNIQUE = "CodeApp101"
SOLUTION_DISPLAY = "CodeApp101"
PUBLISHER_UNIQUE = "CodeApp101Publisher"   # change if a publisher with prefix `cb` already exists
PUBLISHER_DISPLAY = "CodeApp101 Publisher"
OPTION_PREFIX = 10000                       # option values start at 100000000
ROLE_NAME = "Todo User"
ROLE_ID = "{7c1e2b3a-4d5f-4a6b-9c8d-0e1f2a3b4c5d}"  # stable GUID so re-imports update the same role

# ---------------------------------------------------------------- helpers
def ln(*names):  # localized name blocks
    return "".join(f'<LocalizedName description="{escape(n)}" languagecode="{LANG}" />' for n in names)

def desc(text):
    return f'<Descriptions><Description description="{escape(text)}" languagecode="{LANG}" /></Descriptions>'

COMMON_ATTR_FLAGS = """
      <ValidForUpdateApi>1</ValidForUpdateApi>
      <ValidForReadApi>1</ValidForReadApi>
      <ValidForCreateApi>1</ValidForCreateApi>
      <IsCustomField>1</IsCustomField>
      <IsAuditEnabled>1</IsAuditEnabled>
      <IsSecured>0</IsSecured>
      <IntroducedVersion>{v}</IntroducedVersion>
      <IsCustomizable>1</IsCustomizable>
      <IsRenameable>1</IsRenameable>
      <CanModifySearchSettings>1</CanModifySearchSettings>
      <CanModifyRequirementLevelSettings>1</CanModifyRequirementLevelSettings>
      <CanModifyAdditionalSettings>1</CanModifyAdditionalSettings>
      <SourceType>0</SourceType>
      <IsGlobalFilterEnabled>0</IsGlobalFilterEnabled>
      <IsSortableEnabled>0</IsSortableEnabled>
      <IsDataSourceSecret>0</IsDataSourceSecret>
      <AutoNumberFormat></AutoNumberFormat>
      <IsSearchable>1</IsSearchable>
      <IsFilterable>0</IsFilterable>
      <IsRetrievable>0</IsRetrievable>
      <IsLocalizable>0</IsLocalizable>"""

def attr(schema, display, type_, extras, required="none", mask="ValidForAdvancedFind|ValidForForm|ValidForGrid", description="", version=BASE_VERSION):
    logical = schema.lower()
    return f"""
    <attribute PhysicalName="{schema}">
      <Type>{type_}</Type>
      <Name>{logical}</Name>
      <LogicalName>{logical}</LogicalName>
      <RequiredLevel>{required}</RequiredLevel>
      <DisplayMask>{mask}</DisplayMask>
      <ImeMode>auto</ImeMode>{COMMON_ATTR_FLAGS.format(v=version)}
      {extras.strip()}
      <displaynames><displayname description="{escape(display)}" languagecode="{LANG}" /></displaynames>
      {desc(description or display)}
    </attribute>"""

def primary_key(schema, display):
    logical = schema.lower()
    return f"""
    <attribute PhysicalName="{schema}">
      <Type>primarykey</Type>
      <Name>{logical}</Name>
      <LogicalName>{logical}</LogicalName>
      <RequiredLevel>systemrequired</RequiredLevel>
      <DisplayMask>ValidForAdvancedFind|ValidForGrid|ValidForForm</DisplayMask>
      <ValidForUpdateApi>0</ValidForUpdateApi>
      <ValidForReadApi>1</ValidForReadApi>
      <ValidForCreateApi>0</ValidForCreateApi>
      <IsCustomField>1</IsCustomField>
      <IsAuditEnabled>0</IsAuditEnabled>
      <IsSecured>0</IsSecured>
      <IntroducedVersion>{BASE_VERSION}</IntroducedVersion>
      <IsCustomizable>1</IsCustomizable>
      <IsRenameable>1</IsRenameable>
      <CanModifySearchSettings>1</CanModifySearchSettings>
      <CanModifyRequirementLevelSettings>1</CanModifyRequirementLevelSettings>
      <CanModifyAdditionalSettings>1</CanModifyAdditionalSettings>
      <SourceType>0</SourceType>
      <IsGlobalFilterEnabled>0</IsGlobalFilterEnabled>
      <IsSortableEnabled>0</IsSortableEnabled>
      <IsDataSourceSecret>0</IsDataSourceSecret>
      <AutoNumberFormat></AutoNumberFormat>
      <IsSearchable>0</IsSearchable>
      <IsFilterable>0</IsFilterable>
      <IsRetrievable>0</IsRetrievable>
      <IsLocalizable>0</IsLocalizable>
      <displaynames><displayname description="{escape(display)}" languagecode="{LANG}" /></displaynames>
      {desc("Unique identifier for entity instances")}
    </attribute>"""

def text(schema, display, max_len, primary=False, required=None, description=""):
    extras = f"<Format>text</Format><MaxLength>{max_len}</MaxLength><Length>{max_len*2}</Length>"
    if primary:
        return attr(schema, display, "nvarchar", extras, required="required",
                    mask="PrimaryName|ValidForAdvancedFind|ValidForForm|ValidForGrid|RequiredForForm", description=description)
    return attr(schema, display, "nvarchar", extras, required=required or "none", description=description)

def memo(schema, display, max_len=4000, description=""):
    return attr(schema, display, "ntext", f"<Format>text</Format><MaxLength>{max_len}</MaxLength>", description=description)

def whole(schema, display, description=""):
    return attr(schema, display, "int", "<MinValue>-2147483648</MinValue><MaxValue>2147483647</MaxValue>", description=description)

def yesno(entity_schema, schema, display, description=""):
    logical = schema.lower()
    extras = f"""<optionset Name="{entity_schema.lower()}_{logical}">
        <OptionSetType>bit</OptionSetType>
        <IsGlobal>0</IsGlobal>
        <IsCustomizable>1</IsCustomizable>
        <IntroducedVersion>{BASE_VERSION}</IntroducedVersion>
        <displaynames><displayname description="{escape(display)}" languagecode="{LANG}" /></displaynames>
        {desc(description or display)}
        <options>
          <option value="1"><labels><label description="Yes" languagecode="{LANG}" /></labels></option>
          <option value="0"><labels><label description="No" languagecode="{LANG}" /></labels></option>
        </options>
      </optionset>"""
    return attr(schema, display, "bit", extras, description=description)

def datetime_(schema, display, date_only=False, description="", version=BASE_VERSION):
    fmt = "date" if date_only else "datetime"
    behavior = 2 if date_only else 1   # 1 = UserLocal, 2 = DateOnly
    extras = f"<Format>{fmt}</Format><Behavior>{behavior}</Behavior><CanChangeDateTimeBehavior>1</CanChangeDateTimeBehavior>"
    return attr(schema, display, "datetime", extras, description=description, version=version)

def choice(entity_schema, schema, display, options, description=""):
    logical = schema.lower()
    opts = "".join(
        f'<option value="{OPTION_PREFIX*10000 + i}"><labels><label description="{escape(label)}" languagecode="{LANG}" /></labels></option>'
        for i, label in enumerate(options))
    extras = f"""<optionset Name="{entity_schema.lower()}_{logical}">
        <OptionSetType>picklist</OptionSetType>
        <IsGlobal>0</IsGlobal>
        <IsCustomizable>1</IsCustomizable>
        <IntroducedVersion>{BASE_VERSION}</IntroducedVersion>
        <displaynames><displayname description="{escape(display)}" languagecode="{LANG}" /></displaynames>
        {desc(description or display)}
        <options>{opts}</options>
      </optionset>"""
    return attr(schema, display, "picklist", extras, description=description)

def entity(schema, display, plural, description, attributes, color):
    logical = schema.lower()
    return f"""
  <Entity>
    <Name LocalizedName="{escape(display)}" OriginalName="{escape(display)}">{schema}</Name>
    <EntityInfo>
      <entity Name="{schema}">
        <LocalizedNames>{ln(display)}</LocalizedNames>
        <LocalizedCollectionNames><LocalizedCollectionName description="{escape(plural)}" languagecode="{LANG}" /></LocalizedCollectionNames>
        {desc(description)}
        <attributes>{"".join(attributes)}
        </attributes>
        <EntitySetName>{logical}s</EntitySetName>
        <IsDuplicateCheckSupported>0</IsDuplicateCheckSupported>
        <IsBusinessProcessEnabled>0</IsBusinessProcessEnabled>
        <IsRequiredOffline>0</IsRequiredOffline>
        <IsInteractionCentricEnabled>0</IsInteractionCentricEnabled>
        <IsCollaboration>0</IsCollaboration>
        <AutoRouteToOwnerQueue>0</AutoRouteToOwnerQueue>
        <IsConnectionsEnabled>0</IsConnectionsEnabled>
        <IsDocumentManagementEnabled>0</IsDocumentManagementEnabled>
        <AutoCreateAccessTeams>0</AutoCreateAccessTeams>
        <IsOneNoteIntegrationEnabled>0</IsOneNoteIntegrationEnabled>
        <IsKnowledgeManagementEnabled>0</IsKnowledgeManagementEnabled>
        <IsSLAEnabled>0</IsSLAEnabled>
        <IsBPFEntity>0</IsBPFEntity>
        <IsDocumentRecommendationsEnabled>0</IsDocumentRecommendationsEnabled>
        <IsMSTeamsIntegrationEnabled>0</IsMSTeamsIntegrationEnabled>
        <SyncToExternalSearchIndex>0</SyncToExternalSearchIndex>
        <IsMailMergeEnabled>0</IsMailMergeEnabled>
        <IsEnabledForCharts>1</IsEnabledForCharts>
        <IsEnabledForTrace>0</IsEnabledForTrace>
        <IsEnabledForExternalChannels>0</IsEnabledForExternalChannels>
        <IsEnabledInUnifiedInterface>1</IsEnabledInUnifiedInterface>
        <IsQuickCreateEnabled>0</IsQuickCreateEnabled>
        <IsValidForQueue>0</IsValidForQueue>
        <IsPrivate>0</IsPrivate>
        <IsAvailableOffline>0</IsAvailableOffline>
        <IsReadingPaneEnabled>1</IsReadingPaneEnabled>
        <IsAIRUpdated>0</IsAIRUpdated>
        <IsCustomizable>1</IsCustomizable>
        <IsRenameable>1</IsRenameable>
        <IsMappable>1</IsMappable>
        <CanModifyAuditSettings>1</CanModifyAuditSettings>
        <CanModifyMobileVisibility>1</CanModifyMobileVisibility>
        <CanModifyMobileClientVisibility>1</CanModifyMobileClientVisibility>
        <CanModifyConnectionSettings>1</CanModifyConnectionSettings>
        <CanModifyDuplicateDetectionSettings>1</CanModifyDuplicateDetectionSettings>
        <CanModifyMailMergeSettings>1</CanModifyMailMergeSettings>
        <CanModifyQueueSettings>1</CanModifyQueueSettings>
        <CanCreateAttributes>1</CanCreateAttributes>
        <CanCreateForms>1</CanCreateForms>
        <CanCreateCharts>1</CanCreateCharts>
        <CanCreateViews>1</CanCreateViews>
        <CanModifyAdditionalSettings>1</CanModifyAdditionalSettings>
        <CanEnableSyncToExternalSearchIndex>1</CanEnableSyncToExternalSearchIndex>
        <IsVisibleInMobile>0</IsVisibleInMobile>
        <IsVisibleInMobileClient>1</IsVisibleInMobileClient>
        <IsReadOnlyInMobileClient>0</IsReadOnlyInMobileClient>
        <IsOfflineInMobileClient>0</IsOfflineInMobileClient>
        <DaysSinceRecordLastModified>0</DaysSinceRecordLastModified>
        <MobileOfflineFilters></MobileOfflineFilters>
        <IsActivity>0</IsActivity>
        <IsActivityParty>0</IsActivityParty>
        <IsReplicated>0</IsReplicated>
        <IsReplicationUserFiltered>0</IsReplicationUserFiltered>
        <ChangeTrackingEnabled>1</ChangeTrackingEnabled>
        <IntroducedVersion>{BASE_VERSION}</IntroducedVersion>
        <OwnershipTypeMask>UserOwned</OwnershipTypeMask>
        <IsAuditEnabled>0</IsAuditEnabled>
        <IsRetrieveAuditEnabled>0</IsRetrieveAuditEnabled>
        <IsRetrieveMultipleAuditEnabled>0</IsRetrieveMultipleAuditEnabled>
        <EntityHelpUrlEnabled>0</EntityHelpUrlEnabled>
        <EntityColor>{color}</EntityColor>
        <HasRelatedNotes>False</HasRelatedNotes>
        <HasRelatedActivities>False</HasRelatedActivities>
      </entity>
    </EntityInfo>
  </Entity>"""

def relationship(name, referenced, referencing, lookup_schema, lookup_display, required, cascade_delete, nav_name=None):
    """OneToMany: `referenced` (parent) → `referencing` (child) via lookup `lookup_schema` on the child.

    Role type 1 = referencing role (carries the NavPane* elements, nav property = relationship name).
    Role type 0 = referenced role (nav property = the lookup schema name). Import rejects the swap."""
    nav_name = nav_name or lookup_schema
    reqlevel = "required" if required else "none"
    cascade = "Cascade" if cascade_delete == "Cascade" else "NoCascade"
    return f"""
  <EntityRelationship Name="{name}">
    <EntityRelationshipType>OneToMany</EntityRelationshipType>
    <IsCustomizable>1</IsCustomizable>
    <IntroducedVersion>{BASE_VERSION}</IntroducedVersion>
    <IsHierarchical>0</IsHierarchical>
    <ReferencingEntityName>{referencing}</ReferencingEntityName>
    <ReferencedEntityName>{referenced}</ReferencedEntityName>
    <CascadeAssign>{cascade}</CascadeAssign>
    <CascadeDelete>{cascade_delete}</CascadeDelete>
    <CascadeArchive>{cascade if cascade_delete == "Cascade" else "RemoveLink"}</CascadeArchive>
    <CascadeReparent>{cascade}</CascadeReparent>
    <CascadeShare>{cascade}</CascadeShare>
    <CascadeUnshare>{cascade}</CascadeUnshare>
    <CascadeRollupView>NoCascade</CascadeRollupView>
    <IsValidForAdvancedFind>1</IsValidForAdvancedFind>
    <ReferencingAttributeName>{lookup_schema}</ReferencingAttributeName>
    <RelationshipDescription>{desc(lookup_display)}</RelationshipDescription>
    <EntityRelationshipRoles>
      <EntityRelationshipRole>
        <NavPaneDisplayOption>UseCollectionName</NavPaneDisplayOption>
        <NavPaneArea>Details</NavPaneArea>
        <NavPaneOrder>10000</NavPaneOrder>
        <NavigationPropertyName>{name}</NavigationPropertyName>
        <RelationshipRoleType>1</RelationshipRoleType>
      </EntityRelationshipRole>
      <EntityRelationshipRole>
        <NavigationPropertyName>{nav_name}</NavigationPropertyName>
        <RelationshipRoleType>0</RelationshipRoleType>
      </EntityRelationshipRole>
    </EntityRelationshipRoles>
    <field name="{lookup_schema.lower()}" requiredlevel="{reqlevel}" lookupstyle="single" lookupbrowse="0" IsSecured="0" IsCustomizable="1" IsRenameable="1" CanModifySearchSettings="1" CanModifyRequirementLevelSettings="1" CanModifyAdditionalSettings="1" ImeMode="auto" IsSearchable="1" IsFilterable="0" IsRetrievable="0" IsLocalizable="0" IsAuditEnabled="1" IsSortableEnabled="0" IsGlobalFilterEnabled="0" IntroducedVersion="{BASE_VERSION}">
      <displaynames><displayname description="{escape(lookup_display)}" languagecode="{LANG}" /></displaynames>
      {desc(lookup_display)}
    </field>
  </EntityRelationship>"""

# ---------------------------------------------------------------- schema
LIST, TASK, SUB = "cb_TodoList", "cb_TodoTask", "cb_TodoSubtask"

entities = [
    entity(LIST, "Todo List", "Todo Lists", "A bucket of tasks, e.g. Work, Personal, Groceries.", [
        primary_key("cb_TodoListId", "Todo List"),
        text("cb_Name", "Name", 100, primary=True, description="List name shown in the sidebar."),
        whole("cb_SortOrder", "Sort Order", "Manual ordering of lists in the sidebar."),
        yesno(LIST, "cb_IsInbox", "Is Inbox", "Exactly one per user; created automatically and cannot be deleted."),
        yesno(LIST, "cb_IsArchived", "Is Archived", "Hidden from the sidebar but kept."),
    ], "#2E7D6B"),
    entity(TASK, "Todo Task", "Todo Tasks", "A single task belonging to a list.", [
        primary_key("cb_TodoTaskId", "Todo Task"),
        text("cb_Title", "Title", 400, primary=True, description="Task title (date phrases already stripped by the app)."),
        memo("cb_Notes", "Notes", 4000, "Free-form notes."),
        datetime_("cb_DueDate", "Due Date", description="When the task is due (user local). Date-only when Has Time is No."),
        yesno(TASK, "cb_HasTime", "Has Time", "No means the due date is a whole day."),
        datetime_("cb_ReminderAt", "Reminder At", description="When to notify (user local)."),
        datetime_("cb_ReminderEmailSentAt", "Reminder email sent at", description="When the reminder email flow last sent for this reminder; cleared by the app when the reminder changes.", version=VERSION),
        yesno(TASK, "cb_IsCompleted", "Is Completed"),
        datetime_("cb_CompletedOn", "Completed On"),
        choice(TASK, "cb_Recurrence", "Recurrence", ["None", "Daily", "Weekly", "Monthly"], "How the task repeats after completion."),
        whole("cb_SortOrder", "Sort Order", "Manual ordering within the list."),
    ], "#3B5BDB"),
    entity(SUB, "Todo Subtask", "Todo Subtasks", "A checklist step inside a task.", [
        primary_key("cb_TodoSubtaskId", "Todo Subtask"),
        text("cb_Title", "Title", 400, primary=True),
        yesno(SUB, "cb_IsDone", "Is Done"),
        whole("cb_SortOrder", "Sort Order", "Manual ordering within the task."),
    ], "#D9480F"),
]

relationships = [
    relationship("cb_todolist_cb_todotask_list", LIST, TASK, "cb_List", "List", required=True, cascade_delete="Cascade"),
    relationship("cb_todotask_cb_todosubtask_task", TASK, SUB, "cb_Task", "Task", required=True, cascade_delete="Cascade"),
    relationship("cb_todotask_cb_todotask_recurrenceparent", TASK, TASK, "cb_RecurrenceParent", "Recurrence Parent",
                 required=False, cascade_delete="RemoveLink"),
]

def role_privileges():
    out = []
    for ent in (LIST, TASK, SUB):
        for p in ("Create", "Read", "Write", "Delete", "Append", "AppendTo", "Assign", "Share"):
            out.append(f'      <RolePrivilege name="prv{p}{ent}" level="Basic" />')
    return "\n".join(out)

customizations = f"""<?xml version="1.0" encoding="utf-8"?>
<ImportExportXml xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Entities>{"".join(entities)}
  </Entities>
  <Roles>
    <Role name="{ROLE_NAME}" id="{ROLE_ID}">
      <IsCustomizable>1</IsCustomizable>
      <RolePrivileges>
{role_privileges()}
      </RolePrivileges>
    </Role>
  </Roles>
  <Workflows />
  <FieldSecurityProfiles />
  <Templates />
  <EntityMaps />
  <EntityRelationships>{"".join(relationships)}
  </EntityRelationships>
  <OrganizationSettings />
  <optionsets />
  <CustomControls />
  <EntityDataProviders />
  <Languages>
    <Language>{LANG}</Language>
  </Languages>
</ImportExportXml>
"""

root_components = "\n".join(
    [f'      <RootComponent type="1" schemaName="{e.lower()}" behavior="0" />' for e in (LIST, TASK, SUB)] +
    [f'      <RootComponent type="20" id="{ROLE_ID}" behavior="0" />']
)

solution_xml = f"""<?xml version="1.0" encoding="utf-8"?>
<ImportExportXml version="9.2.0.0" SolutionPackageVersion="9.2" languagecode="{LANG}" generatedBy="CrmLive" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <SolutionManifest>
    <UniqueName>{SOLUTION_UNIQUE}</UniqueName>
    <LocalizedNames>{ln(SOLUTION_DISPLAY)}</LocalizedNames>
    {desc("Simple Todo code app: lists, tasks, subtasks and the Todo User role.")}
    <Version>{VERSION}</Version>
    <Managed>0</Managed>
    <Publisher>
      <UniqueName>{PUBLISHER_UNIQUE}</UniqueName>
      <LocalizedNames>{ln(PUBLISHER_DISPLAY)}</LocalizedNames>
      <Descriptions />
      <EMailAddress xsi:nil="true"></EMailAddress>
      <SupportingWebsiteUrl xsi:nil="true"></SupportingWebsiteUrl>
      <CustomizationPrefix>{PREFIX}</CustomizationPrefix>
      <CustomizationOptionValuePrefix>{OPTION_PREFIX}</CustomizationOptionValuePrefix>
      <Addresses>
        <Address>
          <AddressNumber>1</AddressNumber>
          <AddressTypeCode>1</AddressTypeCode>
          <City xsi:nil="true"></City>
          <County xsi:nil="true"></County>
          <Country xsi:nil="true"></Country>
          <Fax xsi:nil="true"></Fax>
          <FreightTermsCode xsi:nil="true"></FreightTermsCode>
          <ImportSequenceNumber xsi:nil="true"></ImportSequenceNumber>
          <Latitude xsi:nil="true"></Latitude>
          <Line1 xsi:nil="true"></Line1>
          <Line2 xsi:nil="true"></Line2>
          <Line3 xsi:nil="true"></Line3>
          <Longitude xsi:nil="true"></Longitude>
          <Name xsi:nil="true"></Name>
          <PostalCode xsi:nil="true"></PostalCode>
          <PostOfficeBox xsi:nil="true"></PostOfficeBox>
          <PrimaryContactName xsi:nil="true"></PrimaryContactName>
          <ShippingMethodCode>1</ShippingMethodCode>
          <StateOrProvince xsi:nil="true"></StateOrProvince>
          <Telephone1 xsi:nil="true"></Telephone1>
          <Telephone2 xsi:nil="true"></Telephone2>
          <Telephone3 xsi:nil="true"></Telephone3>
          <TimeZoneRuleVersionNumber xsi:nil="true"></TimeZoneRuleVersionNumber>
          <UPSZone xsi:nil="true"></UPSZone>
          <UTCOffset xsi:nil="true"></UTCOffset>
          <UTCConversionTimeZoneCode xsi:nil="true"></UTCConversionTimeZoneCode>
        </Address>
        <Address>
          <AddressNumber>2</AddressNumber>
          <AddressTypeCode>1</AddressTypeCode>
          <City xsi:nil="true"></City>
          <County xsi:nil="true"></County>
          <Country xsi:nil="true"></Country>
          <Fax xsi:nil="true"></Fax>
          <FreightTermsCode xsi:nil="true"></FreightTermsCode>
          <ImportSequenceNumber xsi:nil="true"></ImportSequenceNumber>
          <Latitude xsi:nil="true"></Latitude>
          <Line1 xsi:nil="true"></Line1>
          <Line2 xsi:nil="true"></Line2>
          <Line3 xsi:nil="true"></Line3>
          <Longitude xsi:nil="true"></Longitude>
          <Name xsi:nil="true"></Name>
          <PostalCode xsi:nil="true"></PostalCode>
          <PostOfficeBox xsi:nil="true"></PostOfficeBox>
          <PrimaryContactName xsi:nil="true"></PrimaryContactName>
          <ShippingMethodCode>1</ShippingMethodCode>
          <StateOrProvince xsi:nil="true"></StateOrProvince>
          <Telephone1 xsi:nil="true"></Telephone1>
          <Telephone2 xsi:nil="true"></Telephone2>
          <Telephone3 xsi:nil="true"></Telephone3>
          <TimeZoneRuleVersionNumber xsi:nil="true"></TimeZoneRuleVersionNumber>
          <UPSZone xsi:nil="true"></UPSZone>
          <UTCOffset xsi:nil="true"></UTCOffset>
          <UTCConversionTimeZoneCode xsi:nil="true"></UTCConversionTimeZoneCode>
        </Address>
      </Addresses>
    </Publisher>
    <RootComponents>
{root_components}
    </RootComponents>
    <MissingDependencies />
  </SolutionManifest>
</ImportExportXml>
"""

content_types = """<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="text/xml" /></Types>
"""

# ---------------------------------------------------------------- emit
SRC.mkdir(parents=True, exist_ok=True)
files = {"solution.xml": solution_xml, "customizations.xml": customizations, "[Content_Types].xml": content_types}
for name, body in files.items():
    (SRC / name).write_text(body, encoding="utf-8")

# validate well-formedness before zipping
import xml.dom.minidom
for name in files:
    xml.dom.minidom.parse(str(SRC / name))

zip_path = HERE / f"{SOLUTION_UNIQUE}_{VERSION.replace('.', '_')}.zip"
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
    for name in files:
        info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))  # fixed timestamp so reruns are byte-identical
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, (SRC / name).read_bytes())
print(f"wrote {zip_path.relative_to(HERE.parent)} ({zip_path.stat().st_size} bytes)")
