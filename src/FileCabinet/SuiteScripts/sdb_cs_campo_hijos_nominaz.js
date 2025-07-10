/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/record'],
    /**
     * @param{log} log
     * @param{record} record
     */
    function (log, record) {

        /**
         * Function to be executed after page is initialized.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
         *
         * @since 2015.2
         */
        function fieldChanged(scriptContext) {
            try {
                // checkbox
                if (scriptContext.fieldId === "custentity_sdb_hijos_nominaz") {
                    var currentRecord = scriptContext.currentRecord;

                    var childCount = currentRecord.getField({
                        fieldId: "custentity_sdb_numero_hijos_nominaz",
                    });

                    var isHasChildrenChecked = currentRecord.getValue({
                        fieldId: "custentity_sdb_hijos_nominaz",
                    });

                    if (isHasChildrenChecked) {
                        childCount.isDisabled = false;
                    } else {
                        childCount.isDisabled = true;
                        currentRecord.setValue({
                            fieldId: "custentity_sdb_numero_hijos_nominaz",
                            value: "",
                        });
                    }
                }

            } catch (e) {
                log.error({
                    title: 'Error in fieldChanged',
                    details: e
                });
            }
        }

        return {
            fieldChanged: fieldChanged,
        };

    });
